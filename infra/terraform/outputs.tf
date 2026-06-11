output "api_url" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Public URL of the Cloud Run API service."
}

output "web_url" {
  value       = google_cloud_run_v2_service.web.uri
  description = "Public URL of the Cloud Run web service."
}

output "scoring_api_url" {
  value       = var.scoring_api_image != "" ? google_cloud_run_v2_service.scoring_api[0].uri : ""
  description = "Cloud Run run.app URL of the scoring API. Empty when scoring is not deployed."
}

output "scoring_api_custom_url" {
  value       = var.scoring_api_custom_domain != "" ? "https://${var.scoring_api_custom_domain}" : ""
  description = "Custom domain URL for the scoring API. Empty when no custom domain is configured."
}

output "artifact_registry" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/sportivox"
  description = "Push images here. Tag: <registry>/api:<tag> and <registry>/web:<tag>."
}

output "media_bucket" {
  value = google_storage_bucket.media.name
}

output "docs_bucket" {
  value = google_storage_bucket.docs.name
}

output "runtime_service_account" {
  value = data.google_service_account.runtime.email
}
