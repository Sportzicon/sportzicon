resource "random_password" "jwt_access" {
  length  = 64
  special = false
}
resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

# Build a list of secrets we actually need to create.
locals {
  base_secrets = {
    JWT_ACCESS_SECRET  = random_password.jwt_access.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh.result
  }
  optional_secrets = {
    for k, v in {
      OPENAI_API_KEY           = var.openai_api_key
      SENDGRID_API_KEY         = var.sendgrid_api_key
      BOOTSTRAP_ADMIN_EMAIL    = var.bootstrap_admin_email
      BOOTSTRAP_ADMIN_PASSWORD = var.bootstrap_admin_password
    } : k => v if length(v) > 0
  }
  all_secrets = merge(local.base_secrets, local.optional_secrets)
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(keys(local.all_secrets))
  secret_id = "sportivox-${lower(replace(each.value, "_", "-"))}-${var.env}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "this" {
  for_each    = toset(keys(local.all_secrets))
  secret      = google_secret_manager_secret.this[each.value].id
  secret_data = local.all_secrets[each.value]
}
