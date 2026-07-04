variable "project_id" {
  type        = string
  description = "GCP project ID to deploy into."
}

variable "database_url" {
  type        = string
  sensitive   = true
  description = "PostgreSQL connection URL (pooler, port 6543). Used by the API at runtime."
}

variable "direct_url" {
  type        = string
  sensitive   = true
  description = "PostgreSQL direct connection URL (port 5432). Used by Prisma for migrations."
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
  description = "Primary public URL the web app is served on (used for email links). Set after first deploy."
}

variable "web_app_extra_origins" {
  type        = list(string)
  default     = []
  description = "Additional CORS origins for the GCS buckets (e.g. www-prefixed domain, staging URL)."
}

variable "openai_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "OpenAI API key. Stored in Secret Manager."
}

variable "resend_api_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Resend API key for transactional emails."
}

variable "redis_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Upstash Redis connection URL (rediss://...), used for caching. Add \"REDIS_URL\" to optional_secrets to wire it in."
}

variable "email_from" {
  type        = string
  default     = "no-reply@sportivox.app"
  description = "From address for transactional emails."
}

variable "email_from_name" {
  type        = string
  default     = "Sportivox"
  description = "Display name for transactional emails."
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

# Non-sensitive list of which optional secrets to create.
# This is used in for_each so it must NOT be sensitive.
# Set to the names you have values for: ["OPENAI_API_KEY", "SENDGRID_API_KEY", ...]
variable "optional_secrets" {
  type        = set(string)
  default     = []
  description = "Names of optional secrets to create: OPENAI_API_KEY, SENDGRID_API_KEY, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD"
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

variable "scoring_api_image" {
  type        = string
  description = "Full image ref for the scoring API container (e.g. asia-south1-docker.pkg.dev/PROJECT/sportivox/scoring-api:TAG). Leave empty to skip deploying the scoring service."
  default     = ""
}

variable "scoring_cors_origin" {
  type        = string
  description = "Comma-separated CORS origin allowlist for the scoring API. No wildcard support — list explicit origins."
  default     = ""
}

variable "optional_scoring_secrets" {
  type        = set(string)
  default     = []
  description = "Names of optional secrets to create for scoring API: JWT_SECRET, MAIN_JWT_SECRET"
}

variable "scoring_api_custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain for the scoring API (e.g. scoring-api.sportzicon.com). Leave empty to use the Cloud Run run.app URL. If set, a Cloud Run domain mapping is created and Cloudflare DNS must point to it."
}

variable "scoring_database_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "PostgreSQL connection URL for the scoring database (pooler, port 6543)."
}

variable "scoring_direct_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "PostgreSQL direct connection URL for the scoring database (port 5432). Used by Prisma for migrations."
}

variable "scoring_api_url" {
  type        = string
  default     = ""
  description = "Public URL of the scoring backend (e.g. https://sportivox-scoring-api-stg.run.app). Set after first scoring deploy. Used by the web nginx to proxy /scoring-api/ requests."
}
