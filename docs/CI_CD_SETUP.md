# GitHub Actions CI/CD Setup Guide

This guide walks you through setting up automated CI/CD for Sportivox using GitHub Actions.

## Overview

**What this does:**
- Automatically tests your code on every push to `main`
- Builds Docker images and pushes to Google Artifact Registry
- Deploys to Cloud Run using Terraform (after approval)

**Environment:** Staging (sportivox-main GCP project)

---

## Prerequisites

✅ GitHub repository: https://github.com/sportivox/sportivox-main
✅ GCP Project: `sportivox-main`
✅ Artifact Registry: `sportivox` (asia-south1)
✅ Terraform files: `/infra/terraform/`

---

## Step 1: Create GCP Service Account for GitHub Actions

### 1.1 Open Google Cloud Console
Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=sportivox-main

### 1.2 Create a new service account
1. Click **"Create Service Account"**
2. **Service account name:** `github-actions`
3. **Service account ID:** (auto-filled as `github-actions`)
4. Click **"Create and Continue"**

### 1.3 Grant permissions to the service account
On the "Grant this service account access to project" screen, add these roles:

**Mandatory roles:**
- `roles/artifactregistry.writer` — Push Docker images
- `roles/run.developer` — Deploy to Cloud Run
- `roles/iam.serviceAccountUser` — Use service accounts
- `roles/storage.admin` — Manage Terraform state in GCS

**Recommended for Terraform:**
- `roles/compute.admin` — For compute resources
- `roles/monitoring.metricWriter` — For monitoring

Click **"Continue"** then **"Done"**

### 1.4 Create and download the service account key
1. Find the service account you just created: `github-actions`
2. Click on it to open details
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Choose **"JSON"** format
6. Click **"Create"**
7. **Save the downloaded JSON file somewhere safe** (you'll need it in Step 2)

---

## Step 2: Add GitHub Secrets

### 2.1 Open GitHub repository settings
Go to: https://github.com/sportivox/sportivox-main/settings/secrets/actions

### 2.2 Create secrets
Click **"New repository secret"** for each:

**Secret 1: GCP_SA_KEY**
- **Name:** `GCP_SA_KEY`
- **Value:** Open the JSON file you downloaded in Step 1.4
  - Copy the **entire contents** of the JSON file
  - Paste it into the secret value
- Click **"Add secret"**

**Secret 2: GCP_PROJECT_ID**
- **Name:** `GCP_PROJECT_ID`
- **Value:** `sportivox-main`
- Click **"Add secret"**

### 2.3 Verify secrets are created
You should now see in GitHub Secrets:
```
GCP_SA_KEY          ••••••••
GCP_PROJECT_ID      ••••••••
```

---

## Step 3: Prepare Terraform Backend (GCS State)

### 3.1 Create GCS bucket for Terraform state
Run these commands in your terminal:

```bash
# Set your project ID
export PROJECT_ID=sportivox-main

# Create bucket
gsutil mb gs://sportivox-terraform-state-${PROJECT_ID}

# Enable versioning (for state recovery)
gsutil versioning set on gs://sportivox-terraform-state-${PROJECT_ID}

# Verify
gsutil ls gs://sportivox-terraform-state-${PROJECT_ID}
```

**Note:** If you get permission errors, authenticate first:
```bash
gcloud auth login
gcloud config set project sportivox-main
```

### 3.2 Update backend.tf bucket name
Edit `infra/terraform/backend.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "sportivox-terraform-state-sportivox-main"
    prefix = "terraform/state"
  }
}
```

### 3.3 Migrate Terraform state to GCS (one-time)
```bash
cd infra/terraform

# Initialize with remote backend
terraform init

# When prompted: "Do you want to copy existing state to the new backend?"
# Answer: yes
```

---

## Step 4: Create terraform.tfvars.staging

### 4.1 Copy example file
```bash
cp infra/terraform/terraform.tfvars.staging.example infra/terraform/terraform.tfvars.staging
```

### 4.2 Edit terraform.tfvars.staging
Update with your values:

```hcl
project_id   = "sportivox-main"
region       = "asia-south1"
environment  = "staging"

# These will be updated by GitHub Actions
api_image    = "asia-south1-docker.pkg.dev/sportivox-main/sportivox/api:latest"
web_image    = "asia-south1-docker.pkg.dev/sportivox-main/sportivox/web:latest"

# Adjust these as needed
api_min_instances = 1
api_max_instances = 3

api_public_url = "https://api-staging.sportivox.com"  # or use Cloud Run URL
web_app_url    = "https://staging.sportivox.com"      # or use Cloud Run URL

cors_origins   = "https://staging.sportivox.com"

# Keep these as-is for staging
rate_limit_max = 300
auth_rate_limit_max = 20
log_level = "info"
```

### 4.3 Don't commit this file!
Make sure `.gitignore` includes:
```
infra/terraform/terraform.tfvars.staging
infra/terraform/terraform.tfvars.prod
```

---

## Step 5: Test the CI/CD Pipeline

### 5.1 Make a small commit to main
```bash
git checkout main
git pull origin main

# Make a small change (e.g., update README)
echo "# CI/CD test" >> README.md

git add README.md
git commit -m "Test CI/CD pipeline"
git push origin main
```

### 5.2 Watch the workflow
1. Go to: https://github.com/sportivox/sportivox-main/actions
2. You should see a workflow running called **"Deploy to Staging"**
3. Click on it to see live logs

### 5.3 Workflow steps
The workflow will:
1. ✅ Checkout code
2. ✅ Install dependencies (backend + frontend)
3. ✅ Run tests (Jest, Vitest)
4. ✅ Run linting
5. ✅ Build Docker images
6. ✅ Push to Artifact Registry
7. ✅ Update Terraform variables
8. ✅ Run `terraform plan`
9. ✅ Run `terraform apply` (deploy)
10. ✅ Health check the deployed API

### 5.4 Check results
- ✅ **Green checkmark:** Deployment successful!
- ❌ **Red X:** Something failed — check the logs
- Look for error messages in the GitHub Actions logs

---

## Step 6: Verify Deployment

### 6.1 Check Cloud Run
Go to: https://console.cloud.google.com/run?project=sportivox-main

You should see:
- `sportivox-api-staging` (or similar) running
- `sportivox-web-staging` (or similar) running

### 6.2 Check Artifact Registry
Go to: https://console.cloud.google.com/artifacts/docker?project=sportivox-main

You should see images in the `sportivox` repository:
- `api:latest`, `api:main-{commit-sha}`
- `web:latest`, `web:main-{commit-sha}`

### 6.3 Test the API
```bash
# Get the Cloud Run URL from the console, or:
curl https://sportivox-api-staging-{random}.run.app/health
```

You should see:
```json
{"status":"ok"}
```

---

## Troubleshooting

### Workflow fails at "Authenticate to Google Cloud"
**Error:** `Invalid credentials`

**Solution:**
- Check that `GCP_SA_KEY` secret is set correctly
- Verify the JSON file content is complete (no truncation)
- Make sure the service account has necessary roles (Step 1.3)

### Workflow fails at "Terraform Apply"
**Error:** `Permission denied` or `Error acquiring the state lock`

**Solution:**
- Verify the GCS state bucket exists (Step 3.1)
- Check service account has `roles/storage.admin` role
- Run locally to test: `cd infra/terraform && terraform plan -var-file=terraform.tfvars.staging`

### Workflow fails at "Health Check"
**Error:** `Connection refused` or `404`

**Solution:**
- Cloud Run might still be starting (wait 30-60 seconds)
- Check that the API image built successfully
- Look at Cloud Run logs: https://console.cloud.google.com/run/detail/asia-south1/sportivox-api-staging/logs?project=sportivox-main

### Images not pushing to Artifact Registry
**Error:** `Permission denied` or `Authentication failed`

**Solution:**
- Check service account has `roles/artifactregistry.writer`
- Verify the Artifact Registry repo name is correct: `sportivox`
- Check region is correct: `asia-south1`

---

## Next Steps

✅ **Once staging works:**
1. Keep committing to `main` — each push auto-deploys
2. Test in staging at the deployed URL
3. When ready, set up production environment

✅ **For production (later):**
1. Create `sportivox-prod` GCP project
2. Create new service account with limited permissions
3. Set up production GitHub environment with approval gates
4. Create `v1.0.0` git tags to trigger production deployments

---

## Quick Reference

**GitHub Secrets Required:**
```
GCP_SA_KEY       = (JSON service account key)
GCP_PROJECT_ID   = sportivox-main
```

**Environment Variables (in workflows):**
```
GCP_REGION       = asia-south1
GCP_AR_REPO      = sportivox
```

**Terraform Files:**
```
infra/terraform/backend.tf                      (GCS state config)
infra/terraform/terraform.tfvars.staging        (staging values - gitignored)
infra/terraform/terraform.tfvars.staging.example (template)
```

**GitHub Workflows:**
```
.github/workflows/deploy-staging.yml   (auto-deploy on push to main)
.github/workflows/ci.yml               (tests on all PRs + commits)
```

---

## Questions?

If something isn't working:
1. Check the GitHub Actions logs (detailed error messages)
2. Check GCP Cloud Run logs
3. Run Terraform locally to debug: `cd infra/terraform && terraform plan -var-file=terraform.tfvars.staging`

Good luck! 🚀
