resource "random_password" "jwt_access" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 64
  special = false
}

resource "random_password" "scoring_jwt" {
  length  = 64
  special = false
}

# Always-required secrets.
# for_each keys must be non-sensitive strings — these are plain constant names.
locals {
  required_secret_names = toset(["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "JWT_SECRET"])
  # var.optional_secrets is a non-sensitive set(string) — safe for for_each
  all_secret_names = toset(concat(
    tolist(local.required_secret_names),
    tolist(var.optional_secrets),
    tolist(var.optional_scoring_secrets)
  ))
}

resource "google_secret_manager_secret" "this" {
  for_each  = local.all_secret_names
  secret_id = "sportivox-${lower(replace(each.value, "_", "-"))}-${var.env}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = local.all_secret_names
  secret   = google_secret_manager_secret.this[each.value].id
  secret_data = (
    each.value == "JWT_ACCESS_SECRET"        ? random_password.jwt_access.result :
    each.value == "JWT_REFRESH_SECRET"       ? random_password.jwt_refresh.result :
    each.value == "JWT_SECRET"               ? random_password.scoring_jwt.result :
    each.value == "OPENAI_API_KEY"           ? var.openai_api_key :
    each.value == "BOOTSTRAP_ADMIN_EMAIL"    ? var.bootstrap_admin_email :
    each.value == "BOOTSTRAP_ADMIN_PASSWORD" ? var.bootstrap_admin_password :
    ""
  )
}
