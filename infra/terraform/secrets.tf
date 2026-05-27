resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

# All secrets that could be needed
locals {
  all_secrets = {
    JWT_ACCESS_SECRET       = random_password.jwt_access.result
    JWT_REFRESH_SECRET      = random_password.jwt_refresh.result
    OPENAI_API_KEY          = var.openai_api_key
    SENDGRID_API_KEY        = var.sendgrid_api_key
    BOOTSTRAP_ADMIN_EMAIL   = var.bootstrap_admin_email
    BOOTSTRAP_ADMIN_PASSWORD = var.bootstrap_admin_password
  }
}

resource "google_secret_manager_secret" "this" {
  for_each  = local.all_secrets
  secret_id = "sportivox-${lower(replace(each.key, "_", "-"))}-${var.env}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "this" {
  for_each    = local.all_secrets
  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value
}
