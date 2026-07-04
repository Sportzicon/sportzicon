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
          path = "/internal/livez"
        }
        period_seconds  = 30
        timeout_seconds = 5
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "DATABASE_URL"
        value = var.database_url
      }
      env {
        name  = "DIRECT_URL"
        value = var.direct_url
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
        value = var.api_public_url
      }
      env {
        name  = "CORS_ORIGINS"
        value = var.cors_origins
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
        name  = "EMAIL_FROM"
        value = var.email_from
      }
      env {
        name  = "EMAIL_FROM_NAME"
        value = var.email_from_name
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
        for_each = var.optional_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this[env.key].secret_id
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
    google_storage_bucket.media,
    google_storage_bucket.docs,
    google_secret_manager_secret_version.this
  ]
}

locals {
  # Resolve the scoring backend URL in priority order:
  #  1. Explicit var.scoring_api_url (set in tfvars after first scoring deploy)
  #  2. Auto-detected from scoring Cloud Run service (when deployed in same apply)
  #  3. Fallback — nginx returns 502 for /scoring-api/* (scoring not deployed)
  scoring_api_url = var.scoring_api_url != "" ? var.scoring_api_url : (
    try(google_cloud_run_v2_service.scoring_api[0].uri, "http://127.0.0.1:1")
  )
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

      # nginx reads this at startup to proxy /scoring-api/* to the scoring backend.
      env {
        name  = "SCORING_API_URL"
        value = local.scoring_api_url
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Only deployed when scoring_api_image is provided (staging skips this).
resource "google_cloud_run_v2_service" "scoring_api" {
  count    = var.scoring_api_image != "" ? 1 : 0
  name     = "sportivox-scoring-api-${var.env}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = data.google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances_api
      max_instance_count = var.max_instances_api
    }

    containers {
      image = var.scoring_api_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      ports {
        container_port = 4000
      }

      startup_probe {
        http_get {
          path = "/healthz"
        }
        initial_delay_seconds = 2
        period_seconds        = 5
        timeout_seconds       = 3
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/internal/livez"
        }
        period_seconds  = 30
        timeout_seconds = 5
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "DATABASE_URL"
        value = var.scoring_database_url != "" ? var.scoring_database_url : var.database_url
      }
      env {
        name  = "DIRECT_URL"
        value = var.scoring_direct_url != "" ? var.scoring_direct_url : var.direct_url
      }
      env {
        name  = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["JWT_SECRET"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "MAIN_JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.this["JWT_ACCESS_SECRET"].secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "CORS_ORIGIN"
        value = var.scoring_cors_origin
      }
      env {
        name  = "LOG_LEVEL"
        value = "info"
      }

      dynamic "env" {
        for_each = var.optional_scoring_secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this[env.key].secret_id
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
    google_secret_manager_secret_version.this
  ]
}


resource "google_cloud_run_v2_service_iam_member" "api_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "scoring_api_public" {
  count    = var.scoring_api_image != "" ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.scoring_api[0].name
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
