locals {
  name_suffix = var.env

  required_apis = [
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com"
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)
  service  = each.value
  project  = var.project_id

  disable_on_destroy = false
}

# Container registry — single repo for both api and web images.
resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "sportivox"
  description   = "Sportivox container images (${var.env})"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}

# Reference existing runtime service account (created outside Terraform or in previous run)
data "google_service_account" "runtime" {
  account_id = "sportivox-run-${var.env}"
  project    = var.project_id
}

# To create service account (if doesn't exist), uncomment:
# resource "google_service_account" "runtime" {
#   account_id   = "sportivox-run-${local.name_suffix}"
#   display_name = "Sportivox Cloud Run runtime (${var.env})"
# }

# Allow the runtime SA to read secrets, write to Firestore, and use GCS buckets.
resource "google_project_iam_member" "runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${data.google_service_account.runtime.email}"
}

# Logs / monitoring
resource "google_project_iam_member" "runtime_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${data.google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${data.google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${data.google_service_account.runtime.email}"
}
