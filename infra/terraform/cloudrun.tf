resource "google_cloud_run_v2_service" "api" {
  name     = "sportivox-api-${var.env}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = data.google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances_api
      max_instance_count = var.max_instances_api
    }

    containers {
      image = var.api_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      ports {
        container_port = 8080
      }

      startup_probe {
        http_get {
          path = "/readyz"
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/healthz"
        }
        period_seconds  = 30
        timeout_seconds = 5
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "8080"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "WEB_APP_URL"
        value = var.web_app_url
      }
      env {
        name  = "PUBLIC_API_URL"
        value = ""
      }
      env {
        name  = "CORS_ORIGINS"
        value = var.web_app_url
      }
      env {
        name  = "GCS_BUCKET_MEDIA"
        value = google_storage_bucket.media.name
      }
      env {
        name  = "GCS_BUCKET_DOCS"
        value = google_storage_bucket.docs.name
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }

      env {
        name = "JWT_ACCESS_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["JWT_ACCESS_SECRET"].secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["JWT_REFRESH_SECRET"].secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.openai_api_key != "" ? [1] : []
        content {
          name = "OPENAI_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this["OPENAI_API_KEY"].secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.sendgrid_api_key != "" ? [1] : []
        content {
          name = "SENDGRID_API_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this["SENDGRID_API_KEY"].secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.bootstrap_admin_email != "" ? [1] : []
        content {
          name = "BOOTSTRAP_ADMIN_EMAIL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this["BOOTSTRAP_ADMIN_EMAIL"].secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.bootstrap_admin_password != "" ? [1] : []
        content {
          name = "BOOTSTRAP_ADMIN_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this["BOOTSTRAP_ADMIN_PASSWORD"].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_service.apis,
    google_firestore_database.default,
    google_storage_bucket.media,
    google_storage_bucket.docs
  ]
}

resource "google_cloud_run_v2_service" "web" {
  name     = "sportivox-web-${var.env}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      min_instance_count = var.min_instances_web
      max_instance_count = var.max_instances_web
    }

    containers {
      image = var.web_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "256Mi"
        }
        cpu_idle = true
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Both services are public — Cloud Run handles HTTPS automatically.
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
