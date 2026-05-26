variable "project_id" {
  type        = string
  description = "GCP project ID to deploy into."
}

variable "region" {
  type        = string
  default     = "asia-south1"
  description = "Primary region for Cloud Run, Firestore, and storage."
}

variable "env" {
  type        = string
  default     = "prod"
  description = "Environment short name (e.g. dev, stg, prod). Used as a resource suffix."
}

variable "api_image" {
  type        = string
  description = "Full image ref for the API container (e.g. asia-south1-docker.pkg.dev/PROJECT/sportivox/api:TAG)."
}

variable "web_image" {
  type        = string
  description = "Full image ref for the web container."
}

variable "web_app_url" {
  type        = string
  description = "Public URL the web app is served on (used for CORS and email links). Set after first deploy."
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "OpenAI API key. Stored in Secret Manager; leave blank to skip the secret (e.g. dev)."
}

variable "sendgrid_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "SendGrid API key. Stored in Secret Manager."
}

variable "bootstrap_admin_email" {
  type        = string
  default     = ""
  description = "Email to use for the auto-bootstrapped admin user on first deploy."
}

variable "bootstrap_admin_password" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Initial password for the bootstrapped admin. ROTATE IMMEDIATELY after first login."
}

variable "min_instances_api" {
  type    = number
  default = 0
}

variable "max_instances_api" {
  type    = number
  default = 4
}

variable "min_instances_web" {
  type    = number
  default = 0
}

variable "max_instances_web" {
  type    = number
  default = 4
}
