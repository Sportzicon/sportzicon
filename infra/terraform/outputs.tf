output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Public URL of the Cloud Run API service."
}

output "web_url" {
  value       = google_cloud_run_v2_service.web.uri
  description = "Public URL of the Cloud Run web service."
}

output "artifact_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
  description = "Push images here. Tag: <registry>/api:<tag> and <registry>/web:<tag>."
}

output "media_bucket" {
  value = google_storage_bucket.media.name
}

output "docs_bucket" {
  value = google_storage_bucket.docs.name
}

output "runtime_service_account" {
  value = google_service_account.runtime.email
}
