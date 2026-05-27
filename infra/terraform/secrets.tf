resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

# Build a list of secret names (non-sensitive) based on what we need to create
locals {
  # Always create JWT secrets
  base_secret_names = [
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET"
  ]

  # Optional secrets - only add if variable is not empty
  optional_secret_names = concat(
    var.openai_api_key != "" ? ["OPENAI_API_KEY"] : [],
    var.sendgrid_api_key != "" ? ["SENDGRID_API_KEY"] : [],
    var.bootstrap_admin_email != "" ? ["BOOTSTRAP_ADMIN_EMAIL"] : [],
    var.bootstrap_admin_password != "" ? ["BOOTSTRAP_ADMIN_PASSWORD"] : []
  )

  # Combined list of secret names (all non-sensitive strings)
  secret_names = concat(local.base_secret_names, local.optional_secret_names)
}

resource "google_secret_manager_secret" "this" {
  for_each  = toset(local.secret_names)
  secret_id = "sportivox-${lower(replace(each.value, "_", "-"))}-${var.env}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = toset(local.secret_names)
  secret   = google_secret_manager_secret.this[each.value].id

  # Map secret names to their actual values
  secret_data = (
    each.value == "JWT_ACCESS_SECRET" ? random_password.jwt_access.result :
    each.value == "JWT_REFRESH_SECRET" ? random_password.jwt_refresh.result :
    each.value == "OPENAI_API_KEY" ? var.openai_api_key :
    each.value == "SENDGRID_API_KEY" ? var.sendgrid_api_key :
    each.value == "BOOTSTRAP_ADMIN_EMAIL" ? var.bootstrap_admin_email :
    each.value == "BOOTSTRAP_ADMIN_PASSWORD" ? var.bootstrap_admin_password :
    ""
  )
}
