#!/bin/bash
# One-time GCP project bootstrap — run this ONCE before the first CI/CD deployment.
# After this runs, all subsequent deployments are fully automated via GitHub Actions + Terraform.
# The CI/CD workflow creates the Artifact Registry repo and all infrastructure automatically.
#
# Usage (run in GCP Cloud Shell):
#   chmod +x scripts/bootstrap-gcp.sh
#   ./scripts/bootstrap-gcp.sh <GCP_PROJECT_ID>
#
# Example:
#   ./scripts/bootstrap-gcp.sh sportivox-app

set -euo pipefail

PROJECT_ID="${1:?Usage: $0 <GCP_PROJECT_ID>}"
REGION="asia-south1"
SA_CICD="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
SA_RUNTIME="sportivox-run-prod@${PROJECT_ID}.iam.gserviceaccount.com"
STATE_BUCKET="sportivox-terraform-state-${PROJECT_ID}"

echo "==> Bootstrapping GCP project: ${PROJECT_ID}"

# Enable required APIs
echo "==> Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

# Create CI/CD service account
echo "==> Creating CI/CD service account..."
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Already exists, skipping."

# Grant CI/CD SA all roles required by Terraform
echo "==> Granting CI/CD SA roles..."
for ROLE in \
  roles/run.admin \
  roles/artifactregistry.admin \
  roles/secretmanager.admin \
  roles/storage.admin \
  roles/datastore.owner \
  roles/iam.serviceAccountUser \
  roles/iam.serviceAccountAdmin \
  roles/resourcemanager.projectIamAdmin \
  roles/serviceusage.serviceUsageAdmin; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_CICD}" \
    --role="${ROLE}" --quiet
done

# Create runtime service account (referenced as data source by Terraform)
echo "==> Creating runtime service account..."
gcloud iam service-accounts create sportivox-run-prod \
  --display-name="Sportivox Cloud Run runtime" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "    Already exists, skipping."

# Create Terraform state bucket
echo "==> Creating Terraform state bucket..."
gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${STATE_BUCKET}" 2>/dev/null || echo "    Already exists, skipping."
gsutil versioning set on "gs://${STATE_BUCKET}"

# Generate CI/CD SA key for GitHub Secrets
echo ""
echo "==> Generating CI/CD service account key..."
gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account="${SA_CICD}" \
  --project="${PROJECT_ID}"

echo ""
echo "======================================================"
echo "Bootstrap complete!"
echo ""
echo "Add these two secrets to GitHub repository settings:"
echo "  Settings -> Secrets and variables -> Actions"
echo "======================================================"
echo ""
echo "Secret name : GCP_PROJECT_ID"
echo "Secret value: ${PROJECT_ID}"
echo ""
echo "Secret name : GCP_SA_KEY"
echo "Secret value (base64-encoded key below):"
echo ""
base64 -w 0 /tmp/sa-key.json
echo ""
echo ""
echo "======================================================"
echo "Next step: Push to main branch to trigger deployment."
echo "The workflow will create all infrastructure automatically."
echo "======================================================"

rm -f /tmp/sa-key.json
