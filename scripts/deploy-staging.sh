#!/bin/bash
# Staging Deployment Script
# Purpose: Build and push images to GCP Artifact Registry for staging
# Prerequisites:
#   - GCP project configured with gcloud CLI
#   - Service account credentials exported
#   - terraform/terraform.tfvars.staging configured
# Usage: ./scripts/deploy-staging.sh

set -e

echo "🚀 Deploying Sportivox to Staging Environment..."

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-sportivox-staging}
REGION=${GCP_REGION:-asia-south1}
VERSION=${VERSION:-$(date +%s)}  # Unix timestamp
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/sportivox"

echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region:     $REGION"
echo "   Registry:   $REGISTRY"
echo "   Version:    $VERSION"
echo ""

# Verify prerequisites
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  exit 1
fi

if ! command -v gcloud &> /dev/null; then
  echo "❌ gcloud CLI is not installed"
  exit 1
fi

# Check GCP authentication
if ! gcloud config get-value project &> /dev/null; then
  echo "❌ Not authenticated with GCP. Run: gcloud auth login"
  exit 1
fi

cd "$(dirname "$0")/.."

# Configure Docker authentication
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build images
echo "🏗️  Building Docker images..."
echo "   Building API image..."
docker build \
  -t ${REGISTRY}/api:${VERSION} \
  -t ${REGISTRY}/api:latest \
  --target=runtime \
  -f backend/Dockerfile \
  ./backend

echo "   Building Web image..."
docker build \
  -t ${REGISTRY}/web:${VERSION} \
  -t ${REGISTRY}/web:latest \
  --target=runtime \
  --build-arg VITE_API_BASE_URL=https://api-staging.sportivox.com \
  -f frontend/Dockerfile \
  ./frontend

# Push images
echo "📤 Pushing images to Artifact Registry..."
echo "   Pushing API image..."
docker push ${REGISTRY}/api:${VERSION}
docker push ${REGISTRY}/api:latest

echo "   Pushing Web image..."
docker push ${REGISTRY}/web:${VERSION}
docker push ${REGISTRY}/web:latest

# Verify push
echo "✅ Images pushed successfully"
echo ""
echo "📝 Image URLs:"
echo "   API:  ${REGISTRY}/api:${VERSION}"
echo "   Web:  ${REGISTRY}/web:${VERSION}"
echo ""
echo "🚀 Next steps:"
echo "   1. Update terraform/terraform.tfvars.staging with image URLs"
echo "   2. Run: cd infra/terraform && terraform plan -var-file=terraform.tfvars.staging"
echo "   3. Run: terraform apply -var-file=terraform.tfvars.staging"
echo ""
