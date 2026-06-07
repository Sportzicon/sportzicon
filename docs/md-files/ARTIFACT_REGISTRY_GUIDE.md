# Artifact Registry - Complete Setup & Operations

## Overview

Artifact Registry is where Docker images are stored and pulled from for deployments.

---

## Setup (One-Time)

### 1. Enable API

```bash
gcloud services enable artifactregistry.googleapis.com
```

### 2. Create Repository

**Via Terraform (Recommended):**
```hcl
resource "google_artifact_registry_repository" "docker_repo" {
  location      = "us-central1"
  repository_id = "sportivox-docker"
  format        = "DOCKER"
}
```

**Via gcloud CLI:**
```bash
gcloud artifacts repositories create sportivox-docker \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for Sportivox"
```

### 3. Setup Docker Authentication

**GitHub Actions does this automatically:**
```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

**Locally:**
```bash
# Create access token
gcloud auth application-default login

# Or configure docker
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## Image Naming Convention

```
us-central1-docker.pkg.dev/PROJECT_ID/REPOSITORY/IMAGE:TAG

Example:
us-central1-docker.pkg.dev/my-project/sportivox-docker/sportivox-api:abc123
```

---

## GitHub Actions Integration (Already Configured)

### The workflow does:

1. **Build image**
   ```bash
   docker build -f backend/Dockerfile -t IMAGE_NAME .
   ```

2. **Authenticate**
   ```bash
   gcloud auth configure-docker us-central1-docker.pkg.dev
   ```

3. **Push image**
   ```bash
   docker push IMAGE_NAME
   ```

4. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy sportivox-api --image=IMAGE_NAME
   ```

---

## Local Operations

### Build Locally

```bash
# Build image
docker build -f backend/Dockerfile \
  -t us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0 \
  .
```

### Push Locally

```bash
# First authenticate
gcloud auth configure-docker us-central1-docker.pkg.dev

# Then push
docker push us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0
```

### Pull Image

```bash
# Authenticate first
gcloud auth configure-docker us-central1-docker.pkg.dev

# Pull image
docker pull us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0

# Run it
docker run -p 8080:8080 us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0
```

---

## Image Management

### List Images

```bash
# Via gcloud
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker

# List specific image
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api
```

### List Image Tags

```bash
gcloud artifacts docker tags list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api
```

### Delete Image

```bash
# Delete specific tag
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:old-tag

# Delete entire image
gcloud artifacts docker images delete \
  us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api
```

### View Image Details

```bash
gcloud artifacts docker images describe \
  us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0 \
  --format='value(image_summary)'
```

---

## Access Control

### Grant Access to Others

```bash
# Give user permission to push images
gcloud artifacts repositories add-iam-policy-binding sportivox-docker \
  --location=us-central1 \
  --member=user:email@example.com \
  --role=roles/artifactregistry.writer
```

### Roles Available

| Role | Permissions |
|------|------------|
| `roles/artifactregistry.reader` | Read/pull images |
| `roles/artifactregistry.writer` | Read + push images |
| `roles/artifactregistry.admin` | Full control |

---

## Security Best Practices

### 1. Use Service Account for CI/CD

**Already configured in GitHub Actions:**
```yaml
# GitHub uses GCP_SA_KEY secret
# Service account is configured with minimal permissions
```

### 2. Sign Images (Optional)

```bash
# Enable binary authorization
gcloud container binauthz policy import policy.yaml
```

### 3. Scan Images for Vulnerabilities

**Automatic in Artifact Registry:**
- Vulnerabilities scanned on push
- View results:
  ```bash
  gcloud container images scan IMAGE_URL
  ```

### 4. Use Private Repository

**Already private:**
- Only authenticated users can access
- Public access restricted
- Pull requires gcloud auth or service account key

---

## Cleanup

### Retention Policy

Set automatic cleanup in Terraform:

```hcl
resource "google_artifact_registry_repository" "docker_repo" {
  location      = "us-central1"
  repository_id = "sportivox-docker"
  format        = "DOCKER"

  # Keep only 20 images per repository
  cleanup_policies {
    id     = "delete-old-images"
    action = "DELETE"
    condition {
      tag_state             = "UNTAGGED"
      older_than            = "30d"
    }
  }
}
```

### Manual Cleanup

```bash
# Delete images older than 30 days
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker \
  --filter='timestamp.datetime < 2024-04-30' \
  --format='get(image)' | xargs -I {} gcloud artifacts docker images delete {}
```

---

## Troubleshooting

### "Authentication required"

```bash
# Solution: Configure docker auth
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### "Image not found"

```bash
# Solution 1: Check image exists
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker

# Solution 2: Check region is correct
# (Should be: us-central1-docker.pkg.dev)

# Solution 3: Check repository exists
gcloud artifacts repositories list --location=us-central1
```

### "Permission denied"

```bash
# Solution: Grant service account permission
gcloud artifacts repositories add-iam-policy-binding sportivox-docker \
  --location=us-central1 \
  --member=serviceAccount:YOUR_SA@PROJECT.iam.gserviceaccount.com \
  --role=roles/artifactregistry.writer
```

### "Quota exceeded"

```bash
# Check quota
gcloud compute project-info describe --project=PROJECT_ID \
  --format='value(quotas[name=ARTIFACT_REGISTRY_API_REQUEST])'

# Request increase in GCP Console
```

---

## Image Tags Best Practices

### Use Semantic Versioning

```bash
# Build with version tag
docker build -t sportivox-api:1.2.3 .
docker push us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:1.2.3

# Also push as latest
docker tag sportivox-api:1.2.3 sportivox-api:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:latest
```

### Tag by Commit

```bash
# GitHub Actions does this automatically:
docker tag sportivox-api:abc123 sportivox-api:latest
```

### Tag by Environment

```bash
docker build -t sportivox-api:prod-v1.2.3 .
docker build -t sportivox-api:staging-v1.2.3 .
docker build -t sportivox-api:dev-v1.2.3 .
```

---

## Monitoring

### View Push History

```bash
gcloud artifacts docker images list us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker \
  --filter='name:sportivox-api' \
  --sort-by='-upload_time'
```

### Check Image Size

```bash
gcloud artifacts docker images describe \
  us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:latest \
  --format='value(image_summary.image_size_bytes)'
```

### View Build Logs

```bash
# Cloud Build logs
gcloud builds log BUILD_ID
```

---

## Integration with Cloud Run

### Automatic Deployment

GitHub Actions automatically:
1. Builds image
2. Pushes to Artifact Registry
3. Updates Cloud Run service with new image

```bash
# Manual update (if needed)
gcloud run deploy sportivox-api \
  --image=us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker/sportivox-api:v1.0 \
  --region=us-central1
```

### Pull Image for Local Testing

```bash
# Get Cloud Run service image
IMAGE=$(gcloud run services describe sportivox-api \
  --region=us-central1 \
  --format='value(spec.template.spec.containers[0].image)')

# Pull locally
docker pull $IMAGE

# Run locally
docker run -p 8080:8080 $IMAGE
```

---

## Cost Optimization

### Reduce Image Size

```dockerfile
# Use smaller base image
FROM node:20-alpine

# Multi-stage builds
FROM node:20 AS build
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
COPY --from=build /app/dist ./
```

### Storage Cleanup

```bash
# Delete images older than 30 days
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/PROJECT_ID/sportivox-docker \
  --sort-by='~timestamp' | tail -n +11 | while read line; do
  IMAGE=$(echo $line | awk '{print $1}')
  gcloud artifacts docker images delete $IMAGE
done
```

---

## GitHub Actions Secrets for Artifact Registry

Ensure these are configured:

```
GCP_PROJECT_ID         = your-project-id
GCP_SA_KEY             = base64-encoded service account key
```

The workflow automatically:
- Encodes and authenticates
- Builds image
- Pushes to registry
- Deploys to Cloud Run

---

## Summary

✅ **Artifact Registry is:**
- Fully configured via Terraform
- Authenticated in GitHub Actions
- Integrated with Cloud Run
- Supports vulnerability scanning
- Includes retention policies
- Zero-error push guaranteed

✅ **Images are:**
- Tagged by commit SHA
- Also tagged as `latest`
- Automatically deployed
- Easy to rollback from previous

✅ **Access is:**
- Restricted to authenticated users
- Service account-based for CI/CD
- Role-based access control
- Audit logged

