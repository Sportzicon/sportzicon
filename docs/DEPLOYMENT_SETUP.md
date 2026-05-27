# Production Deployment to GCP Cloud Run

This guide walks you through deploying Sportivox to Google Cloud Platform (GCP) Cloud Run with proper environment separation.

## Overview

Sportivox uses:
- **Cloud Run** — Serverless container platform for API and web app
- **Firestore** — NoSQL database
- **Google Cloud Storage (GCS)** — Media and document storage
- **Secret Manager** — Secure credential storage
- **Terraform** — Infrastructure as code
- **Cloud Build** — CI/CD pipeline (optional)

All infrastructure is defined in `/infra/terraform/` and ready to deploy.

## Prerequisites

### 1. GCP Project Setup

```bash
# Create a new GCP project or use an existing one
gcloud projects create sportivox-prod --name="Sportivox Production"

# Set as default project
gcloud config set project sportivox-prod

# Enable billing
gcloud alpha billing projects link sportivox-prod --billing-account=BILLING_ACCOUNT_ID

# Verify
gcloud projects describe sportivox-prod
```

### 2. Local Tools

Install required tools:
```bash
# Google Cloud CLI
curl https://sdk.cloud.google.com | bash

# Terraform (v1.0+)
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Docker
# Download Docker Desktop: https://www.docker.com/products/docker-desktop

# Verify installations
gcloud --version
terraform --version
docker --version
```

### 3. GCP Credentials

Create a service account for Terraform:

```bash
# Create service account
gcloud iam service-accounts create terraform-admin \
  --display-name="Terraform Admin"

# Grant permissions
gcloud projects add-iam-policy-binding sportivox-prod \
  --member="serviceAccount:terraform-admin@sportivox-prod.iam.gserviceaccount.com" \
  --role="roles/owner"  # Simplified - use least privilege in production

# Create and download key
gcloud iam service-accounts keys create terraform-key.json \
  --iam-account=terraform-admin@sportivox-prod.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=$(pwd)/terraform-key.json

# Verify
gcloud auth application-default print-access-token
```

⚠️ **SECURITY**: 
- Keep `terraform-key.json` safe (add to `.gitignore`)
- Use service account, not your personal account
- Rotate keys periodically

## Step 1: Prepare Configuration Files

### Create Terraform Variables

```bash
# Copy template
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars.prod

# Edit with your values
nano infra/terraform/terraform.tfvars.prod
```

**Required variables:**
```hcl
# terraform/terraform.tfvars.prod
project_id     = "sportivox-prod"
region          = "asia-south1"  # or your preferred region
environment     = "production"

# These values come AFTER you build and push images
api_image       = "asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:v1.0.0"
web_image       = "asia-south1-docker.pkg.dev/sportivox-prod/sportivox/web:v1.0.0"

# Your production domains
api_public_url  = "https://api.sportivox.com"
web_app_url     = "https://app.sportivox.com"

# Optional: Custom secrets (Terraform auto-generates JWT)
openai_api_key  = "sk-..."  # If using AI features
sendgrid_api_key = "SG..."  # If sending emails
```

### Create Environment Files

```bash
# Backend production env
cp backend/.env.production.example backend/.env.production
nano backend/.env.production

# Frontend production env
cp frontend/.env.production.example frontend/.env.production
nano frontend/.env.production
```

## Step 2: Build and Push Docker Images

### Enable Artifact Registry

```bash
# Enable required APIs
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable cloudrun.googleapis.com

# Create Artifact Registry repository
gcloud artifacts repositories create sportivox \
  --repository-format=docker \
  --location=asia-south1

# Verify
gcloud artifacts repositories list
```

### Build Docker Images

```bash
# Set variables
PROJECT_ID=sportivox-prod
REGION=asia-south1
VERSION=v1.0.0  # Use your version (git commit hash, date, etc.)
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/sportivox"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build backend image
docker build -t ${REGISTRY}/api:${VERSION} \
  --target=runtime \
  -f backend/Dockerfile \
  ./backend

# Build frontend image (with real API URL)
docker build -t ${REGISTRY}/web:${VERSION} \
  --target=runtime \
  --build-arg VITE_API_BASE_URL=https://api.sportivox.com \
  -f frontend/Dockerfile \
  ./frontend

# Tag as 'latest' too
docker tag ${REGISTRY}/api:${VERSION} ${REGISTRY}/api:latest
docker tag ${REGISTRY}/web:${VERSION} ${REGISTRY}/web:latest
```

### Push to Artifact Registry

```bash
# Push images
docker push ${REGISTRY}/api:${VERSION}
docker push ${REGISTRY}/api:latest
docker push ${REGISTRY}/web:${VERSION}
docker push ${REGISTRY}/web:latest

# Verify
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/sportivox
```

## Step 3: Deploy with Terraform

### Initialize Terraform

```bash
cd infra/terraform

# Download providers
terraform init

# Validate configuration
terraform validate

# Plan deployment (review changes)
terraform plan -var-file=terraform.tfvars.prod -out=tfplan
```

Review the plan output carefully. You should see:
- Cloud Run services (api, web)
- Firestore database
- GCS buckets
- Secret Manager secrets
- Service account and IAM roles

### Apply Terraform Configuration

```bash
# Deploy to GCP
terraform apply tfplan

# Terraform will:
# 1. Create Cloud Run services
# 2. Create Firestore database with indexes
# 3. Create GCS buckets
# 4. Create Secret Manager secrets
# 5. Set up IAM roles and service accounts
# 6. Print output URLs

# Save outputs
terraform output
```

⏳ **Wait time**: Firestore indexes can take 5-10 minutes to build. Cloud Run deployment is immediate.

### Verify Deployment

```bash
# Check Cloud Run services
gcloud run services list --region asia-south1

# Check API health
API_URL=$(terraform output -raw api_url)
curl ${API_URL}/api/v1/health

# Check Web service
WEB_URL=$(terraform output -raw web_url)
curl ${WEB_URL}

# View logs
gcloud run services logs read sportivox-api-prod --region asia-south1 --limit=50
gcloud run services logs read sportivox-web-prod --region asia-south1 --limit=50
```

## Step 4: Update DNS (if using custom domains)

If you're using custom domains instead of Cloud Run URLs:

```bash
# Get Cloud Run IP
gcloud run services describe sportivox-api-prod \
  --region=asia-south1 \
  --format='value(status.url)'

# Update DNS records in your domain registrar
# A record: api.sportivox.com → Cloud Run IP
# A record: app.sportivox.com → Cloud Run IP

# Verify DNS
nslookup api.sportivox.com
curl https://api.sportivox.com/api/v1/health
```

## Step 5: Configure Cloud Build (Optional CI/CD)

For automatic deployment on git push:

```bash
# Create Cloud Build trigger
gcloud builds create \
  --trigger-name sportivox-main \
  --repo-name sportivox-main \
  --repo-owner sportivox \
  --branch-pattern="^main$" \
  --build-config infra/cloudbuild.yaml \
  --substitutions=_REGION=asia-south1,_AR_REPO=sportivox,_API_SERVICE=sportivox-api-prod,_WEB_SERVICE=sportivox-web-prod,_API_PUBLIC_URL=https://api.sportivox.com,_WEB_APP_URL=https://app.sportivox.com

# Verify trigger
gcloud builds triggers list
```

Or manually trigger builds:
```bash
gcloud builds submit --config infra/cloudbuild.yaml
```

## Step 6: Post-Deployment Tasks

### 1. Change Bootstrap Admin Password

The initial admin account uses the password from `BOOTSTRAP_ADMIN_PASSWORD`. Change it IMMEDIATELY:

```bash
# Login to http://app.sportivox.com
# Email: admin@sportivox.com
# Password: (from your .env.production)

# Change password in account settings
# Then rotate the secret in Secret Manager:
gcloud secrets versions add BOOTSTRAP_ADMIN_PASSWORD --data-file=new-password.txt

# Redeploy Cloud Run to use new secret
gcloud run deploy sportivox-api-prod \
  --image asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:latest \
  --region asia-south1
```

### 2. Set Up Monitoring

```bash
# Create uptime checks
gcloud monitoring uptime-configs create api-health \
  --display-name="Sportivox API Health" \
  --monitored-resource=uptime-url \
  --resource-labels=host=api.sportivox.com \
  --http-check-use-ssl=true

# View metrics in Cloud Console
# https://console.cloud.google.com/monitoring
```

### 3. Enable Automatic Backups (Firestore)

```bash
# Firestore backups are configured in Terraform
# Verify in Cloud Console:
gcloud firestore backups list --location=asia-south1
```

### 4. Configure Cloud Storage Lifecycle

```bash
# Set lifecycle rules for old media (already in Terraform)
# Archive media older than 1 year
# Archive docs older than 7 years

# Verify
gcloud storage buckets describe gs://sportivox-media-prod \
  --format='value(lifecycle)'
```

## Updating Production

### Update Code

```bash
# Make changes to code
# Commit and push
git push origin main

# If using Cloud Build, it triggers automatically

# Or manually:
docker build -t asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:v1.0.1 \
  --target=runtime \
  -f backend/Dockerfile ./backend

docker push asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:v1.0.1

# Update terraform.tfvars
sed -i 's/api_image.*/api_image = "asia-south1-docker.pkg.dev\/sportivox-prod\/sportivox\/api:v1.0.1"/' infra/terraform/terraform.tfvars.prod

# Redeploy
cd infra/terraform
terraform apply -var-file=terraform.tfvars.prod
```

### Update Secrets

```bash
# Add new secret version
gcloud secrets versions add SENDGRID_API_KEY --data-file=new-key.txt

# Redeploy to pick up new version
gcloud run deploy sportivox-api-prod \
  --image asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:latest \
  --region asia-south1
```

## Troubleshooting

### Cloud Run service won't start

```bash
# Check logs
gcloud run services logs read sportivox-api-prod --region asia-south1 --limit=100

# Common issues:
# - Environment variables missing (check Secret Manager)
# - Database not initialized (check Firestore)
# - Port mismatch (should be 8080)
```

### Database queries timing out

```bash
# Check Firestore indexes are built
gcloud firestore indexes list --database='(default)'

# Rebuild if needed
gcloud firestore indexes create \
  --collection-group=opportunities \
  --field-config field-path=status,order=ascending \
  --field-config field-path=created_at,order=descending
```

### GCS upload failures

```bash
# Verify bucket permissions
gcloud storage buckets iam ch \
  serviceAccount:sportivox-run-prod@sportivox-prod.iam.gserviceaccount.com:objectAdmin \
  gs://sportivox-media-prod

# Check bucket CORS
gcloud storage buckets describe gs://sportivox-media-prod --format=json | jq '.cors'
```

### Out of memory

Increase Cloud Run memory in Terraform:
```hcl
# terraform/cloudrun.tf
memory = "1Gi"  # Change from 512Mi
```

Then `terraform apply`.

## Cost Estimation

Monthly costs (estimated):
- **Cloud Run**: $5-20 (pay per request + time)
- **Firestore**: $0 (free tier) to $10+
- **Cloud Storage**: $0.05-5 (storage + operations)
- **Secret Manager**: $0.30 (fixed)
- **Artifact Registry**: $0.10 (storage)

Total: ~$6-40/month for small production workload

## Rollback Procedure

If deployment causes issues:

```bash
# Option 1: Revert to previous image
docker pull asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:previous

gcloud run deploy sportivox-api-prod \
  --image asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:previous \
  --region asia-south1

# Option 2: Revert Terraform
git revert HEAD  # Revert last commit
terraform apply -var-file=terraform.tfvars.prod

# Check Cloud Run revisions
gcloud run revisions list --service sportivox-api-prod --region asia-south1
```

## Security Checklist

Before going live:
- [ ] All secrets rotated (don't use development values)
- [ ] CORS origins set to production domain only
- [ ] Rate limits configured for production
- [ ] HTTPS enforced (automatic with Cloud Run)
- [ ] Service account has minimal permissions
- [ ] Firestore security rules are deployed
- [ ] Cloud SQL passwords are strong
- [ ] Audit logging is enabled
- [ ] Monitoring alerts are configured
- [ ] Backup retention is set

## Next Steps

1. ✅ Deployed to production
2. Set up monitoring and alerts
3. Configure automated backups
4. Document custom configurations
5. Train team on deployment procedures
6. Plan disaster recovery procedures

## References

- [Terraform Configuration](../infra/terraform/)
- [Environment Variables Guide](ENVIRONMENT_CONFIG.md)
- [Secrets Management](SECRETS_MANAGEMENT.md)
- [GCP Cloud Run Docs](https://cloud.google.com/run/docs)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest)
