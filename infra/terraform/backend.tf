# Terraform remote backend configuration
# Stores state in Google Cloud Storage instead of local filesystem
# Enables team collaboration and CI/CD pipeline access
#
# Backend bucket: sportivox-terraform-state-sportivox-main
# This must be created manually before running terraform init
#
# To set up:
# gsutil mb gs://sportivox-terraform-state-sportivox-main
# gsutil versioning set on gs://sportivox-terraform-state-sportivox-main

terraform {
  backend "gcs" {
    bucket = "sportivox-terraform-state-sportivox-main"
    prefix = "terraform/state"
  }
}
