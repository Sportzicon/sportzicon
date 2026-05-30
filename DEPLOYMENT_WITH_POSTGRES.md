# 🚀 Deployment with PostgreSQL - Complete Guide

## Overview

You have:
- ✅ PostgreSQL database running in GCP
- ✅ Data migrated from Firestore
- ✅ App running on Cloud Run

Now: **Setup automatic deployment with GitHub → Cloud Run**

---

## STEP 1: Create GitHub Actions Workflow (5 min)

Create file: `.github/workflows/deploy-prod.yml`

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: europe-north1
  SERVICE_NAME: sportivox-api

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ env.PROJECT_ID }}

      - name: Configure Docker
        run: gcloud auth configure-docker gcr.io

      - name: Build Docker image
        run: |
          docker build \
            -t gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            -t gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:latest \
            -f backend/Dockerfile \
            .

      - name: Push to Google Container Registry
        run: |
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:${{ github.sha }}
          docker push gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy ${{ env.SERVICE_NAME }} \
            --image=gcr.io/${{ env.PROJECT_ID }}/${{ env.SERVICE_NAME }}:${{ github.sha }} \
            --platform=managed \
            --region=${{ env.REGION }} \
            --allow-unauthenticated \
            --update-env-vars=DATABASE_URL="${{ secrets.DATABASE_URL }}" \
            --memory=512Mi \
            --cpu=1 \
            --timeout=3600 \
            --max-instances=100

      - name: Verify deployment
        run: |
          SERVICE_URL=$(gcloud run services describe ${{ env.SERVICE_NAME }} \
            --region=${{ env.REGION }} \
            --format='value(status.url)')
          
          for i in {1..30}; do
            if curl -sf "$SERVICE_URL/healthz" > /dev/null; then
              echo "✓ Service is healthy"
              exit 0
            fi
            echo "Waiting for service... ($i/30)"
            sleep 2
          done
          
          echo "✗ Health check failed"
          exit 1

      - name: Success notification
        if: success()
        run: |
          echo "✅ Deployment successful!"
          echo "Service URL: $(gcloud run services describe ${{ env.SERVICE_NAME }} --region=${{ env.REGION }} --format='value(status.url)')"
```

---

## STEP 2: Add GitHub Secrets (5 min)

Go to: **GitHub repo → Settings → Secrets and variables → Repository secrets**

Add these **3 secrets:**

```
GCP_PROJECT_ID = your-project-id

GCP_SA_KEY = (base64 encoded service account key)

DATABASE_URL = postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox
```

**How to get GCP_SA_KEY:**

```bash
# Create service account
gcloud iam service-accounts create github-deploy

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/editor

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=github-deploy@$PROJECT_ID.iam.gserviceaccount.com

# Encode it
base64 key.json | tr -d '\n'
```

Copy the encoded output → Add as `GCP_SA_KEY` secret

---

## STEP 3: Update Cloud Run Service (3 min)

Make sure your running service has the DATABASE_URL:

```bash
SERVICE_NAME="sportivox-api"
REGION="europe-north1"
DATABASE_URL="postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox"

gcloud run services update $SERVICE_NAME \
  --region=$REGION \
  --update-env-vars=DATABASE_URL="$DATABASE_URL"

# Verify
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(spec.template.spec.containers[0].env[?name==`DATABASE_URL`].value)'
```

---

## STEP 4: Test Deployment (2 min)

Push a small change to test:

```bash
# Make a small change (e.g., update README)
echo "# Updated at $(date)" >> README.md

# Commit and push
git add README.md
git commit -m "test: trigger deployment"
git push origin main
```

**Watch the deployment:**

Go to: **GitHub repo → Actions → Deploy to Cloud Run**

You should see:
1. ✅ Checkout code
2. ✅ Authenticate to Google Cloud
3. ✅ Build Docker image
4. ✅ Push to registry
5. ✅ Deploy to Cloud Run
6. ✅ Verify deployment

**Total time: 5-10 minutes**

---

## STEP 5: Verify Deployment Works (2 min)

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe sportivox-api \
  --region=europe-north1 \
  --format='value(status.url)')

echo "Service URL: $SERVICE_URL"

# Test health endpoint
curl "$SERVICE_URL/healthz"
# Should return: {"ok":true,"service":"sportivox-api","env":"production"}

# Test API endpoint
curl "$SERVICE_URL/api/v1/users/me"
# Should return user data from PostgreSQL
```

---

## ✅ Deployment Flow

Every time you push to `main`:

```
git push origin main
         ↓
GitHub Actions triggered
         ↓
Build Docker image
         ↓
Push to Google Container Registry
         ↓
Deploy to Cloud Run
         ↓
Health check verification
         ↓
✅ API is live with new code
```

**Time: ~5-10 minutes (automatic)**

---

## Emergency: Rollback to Previous Version

```bash
# List recent revisions
gcloud run revisions list \
  --service=sportivox-api \
  --region=europe-north1

# Rollback to previous
gcloud run services update-traffic sportivox-api \
  --region=europe-north1 \
  --to-revisions=PREVIOUS_REVISION_ID=100
```

---

## Monitoring Deployment

### View Logs

```bash
# Real-time logs
gcloud run services logs read sportivox-api \
  --region=europe-north1 \
  --follow

# Recent logs
gcloud run services logs read sportivox-api \
  --region=europe-north1 \
  --limit=50
```

### Check Service Status

```bash
gcloud run services describe sportivox-api \
  --region=europe-north1 \
  --format='yaml' | grep -A 5 "status:"
```

### View Deployment History

```bash
# All revisions
gcloud run revisions list \
  --service=sportivox-api \
  --region=europe-north1

# Specific revision details
gcloud run revisions describe REVISION_ID \
  --region=europe-north1
```

---

## Common Issues & Fixes

### "Deployment failed: Pod failed to start"

**Check logs:**
```bash
gcloud run services logs read sportivox-api --region=europe-north1 --limit=20
```

**Common causes:**
- DATABASE_URL missing or wrong
- Container can't connect to database

**Fix:**
```bash
# Update env var
gcloud run services update sportivox-api \
  --region=europe-north1 \
  --update-env-vars=DATABASE_URL="postgresql://..."
```

### "Health check failed"

**Check if API is responding:**
```bash
curl -v https://your-service-url/healthz
```

**Check database connection:**
```bash
psql "postgresql://sportivox:PASSWORD@IP:5432/sportivox"
SELECT 1;
\q
```

### "Permission denied" when deploying

**Fix service account permissions:**
```bash
PROJECT_ID=$(gcloud config get-value project)

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin
```

---

## Deployment Checklist

Before your first deployment:

- [ ] GitHub Actions workflow created (`.github/workflows/deploy-prod.yml`)
- [ ] Service account created (`github-deploy`)
- [ ] Roles granted to service account
- [ ] Service account key created and encoded
- [ ] 3 secrets added to GitHub:
  - `GCP_PROJECT_ID`
  - `GCP_SA_KEY`
  - `DATABASE_URL`
- [ ] Cloud Run service updated with `DATABASE_URL`
- [ ] Health endpoint working (`/healthz`)
- [ ] API endpoints returning data from PostgreSQL

---

## Deployment Process Summary

1. **First time setup (10 minutes):**
   - Create GitHub Actions workflow
   - Add 3 GitHub secrets
   - Update Cloud Run with DATABASE_URL

2. **Every deployment (automatic 5-10 minutes):**
   - `git push origin main`
   - GitHub Actions runs automatically
   - New code deployed to Cloud Run
   - Health checks verify it's working

3. **Rollback (1 minute):**
   - If something breaks, revert to previous revision

---

## Complete Deployment Script

```bash
#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"
REGION="europe-north1"
SERVICE_NAME="sportivox-api"
GITHUB_REPO="your-username/your-repo"

# 1. Create service account
echo "Creating service account..."
gcloud iam service-accounts create github-deploy \
  --display-name="GitHub Deploy Service Account"

# 2. Grant roles
echo "Granting roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:github-deploy@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin

# 3. Create and encode key
echo "Creating service account key..."
gcloud iam service-accounts keys create key.json \
  --iam-account=github-deploy@$PROJECT_ID.iam.gserviceaccount.com

GCP_SA_KEY=$(base64 key.json | tr -d '\n')

# 4. Get database URL
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres \
  --format='value(ipAddresses[0].ipAddress)')

echo ""
echo "✅ Setup complete! Add these secrets to GitHub:"
echo ""
echo "GCP_PROJECT_ID = $PROJECT_ID"
echo "GCP_SA_KEY = $GCP_SA_KEY"
echo "DATABASE_URL = postgresql://sportivox:PASSWORD@$PUBLIC_IP:5432/sportivox"
echo ""
echo "Steps:"
echo "1. Go to GitHub → Settings → Secrets"
echo "2. Add the 3 secrets above"
echo "3. Create .github/workflows/deploy-prod.yml (see guide)"
echo "4. git push origin main to trigger deployment"

# Clean up
rm key.json
```

---

## Next: Automatic Deployments

Your app now deploys automatically when you push to GitHub!

```bash
# 1. Make a change
echo "# Updated $(date)" >> README.md

# 2. Commit and push
git add .
git commit -m "chore: update readme"
git push origin main

# 3. Watch deployment
# GitHub Actions → Deploy to Cloud Run → Watch logs

# 4. Verify
curl https://your-service-url/healthz
# Should return 200 OK in 5-10 minutes
```

---

**Deployment is ready!** 🚀

Push to main and watch GitHub Actions deploy your app automatically.

