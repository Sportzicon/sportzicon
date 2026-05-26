locals {
  name_suffix = var.env

  required_apis = [
    "run.googleapis.com",
    "firestore.googleapis.com",
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

# Dedicated runtime service account for Cloud Run revisions.
resource "google_service_account" "runtime" {
  account_id   = "sportivox-run-${local.name_suffix}"
  display_name = "Sportivox Cloud Run runtime (${var.env})"
}

# Allow the runtime SA to read secrets, write to Firestore, and use GCS buckets.
resource "google_project_iam_member" "runtime_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# Logs / monitoring
resource "google_project_iam_member" "runtime_logs_writer" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_metric_writer" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_trace_agent" {
  project = var.project_id
  role    = "roles/cloudtrace.agent"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
