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

variable "api_public_url" {
  type        = string
  description = "Public URL for the API service (used for CORS)."
  default     = ""
}

variable "cors_origins" {
  type        = string
  description = "CORS origin URL for the web app."
  default     = ""
}

variable "api_port" {
  type        = number
  description = "Port the API listens on."
  default     = 8080
}

variable "log_level" {
  type        = string
  description = "Log level (debug, info, warn, error)."
  default     = "info"
}

variable "rate_limit_window_ms" {
  type        = number
  description = "Rate limit window in milliseconds."
  default     = 900000
}

variable "rate_limit_max" {
  type        = number
  description = "Maximum requests per rate limit window."
  default     = 1000
}

variable "auth_rate_limit_max" {
  type        = number
  description = "Maximum auth requests per rate limit window."
  default     = 50
}

variable "api_memory" {
  type        = string
  description = "Memory allocation for API service."
  default     = "512Mi"
}

variable "api_cpu" {
  type        = string
  description = "CPU allocation for API service."
  default     = "1"
}

variable "web_memory" {
  type        = string
  description = "Memory allocation for Web service."
  default     = "256Mi"
}

variable "web_cpu" {
  type        = string
  description = "CPU allocation for Web service."
  default     = "1"
}

variable "api_min_instances" {
  type        = number
  description = "Minimum instances for API service."
  default     = 1
}

variable "api_max_instances" {
  type        = number
  description = "Maximum instances for API service."
  default     = 4
}

variable "web_min_instances" {
  type        = number
  description = "Minimum instances for Web service."
  default     = 1
}

variable "web_max_instances" {
  type        = number
  description = "Maximum instances for Web service."
  default     = 4
}

variable "gcs_bucket_terraform_state" {
  type        = string
  description = "GCS bucket name for Terraform state."
  default     = ""
}

variable "environment" {
  type        = string
  description = "Environment name (staging, production)."
  default     = "staging"
}
