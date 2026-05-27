#!/bin/bash
# Production Deployment Script
# Purpose: Build and push images to GCP Artifact Registry for production
# ⚠️  THIS DEPLOYS TO PRODUCTION - Be careful!
#
# Prerequisites:
#   - GCP production project configured
#   - Service account with production permissions
#   - terraform/terraform.tfvars.prod configured
#   - All secrets rotated and ready
#
# Usage: VERSION=v1.0.0 ./scripts/deploy-prod.sh
# Environment Variables:
#   VERSION - (required) Version tag (e.g., v1.0.0, 2024-01-15)
#   GCP_PROJECT_ID - (optional) GCP project ID
#   GCP_REGION - (optional) GCP region

set -e

# Get version from argument
if [ -z "$VERSION" ]; then
  echo "❌ VERSION environment variable is required"
  echo "Usage: VERSION=v1.0.0 ./scripts/deploy-prod.sh"
  exit 1
fi

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-sportivox-prod}
REGION=${GCP_REGION:-asia-south1}
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/sportivox"

echo "⚠️  PRODUCTION DEPLOYMENT"
echo "================================"
echo "🚀 Deploying Sportivox to Production..."
echo ""
echo "📋 Configuration:"
echo "   Project ID: $PROJECT_ID"
echo "   Region:     $REGION"
echo "   Registry:   $REGISTRY"
echo "   Version:    $VERSION"
echo ""

# Confirmation
read -p "⚠️  This will deploy to PRODUCTION. Type 'yes' to continue: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Verify prerequisites
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed"
  exit 1
fi

if ! command -v gcloud &> /dev/null; then
  echo "❌ gcloud CLI is not installed"
  exit 1
fi

if ! gcloud config get-value project &> /dev/null; then
  echo "❌ Not authenticated with GCP. Run: gcloud auth login"
  exit 1
fi

# Verify we're on main branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  WARNING: You are on branch '$BRANCH', not 'main'"
  read -p "Continue anyway? (yes/no): " CONTINUE
  if [ "$CONTINUE" != "yes" ]; then
    exit 1
  fi
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
  -t ${REGISTRY}/api:prod-latest \
  --target=runtime \
  -f backend/Dockerfile \
  ./backend

echo "   Building Web image..."
docker build \
  -t ${REGISTRY}/web:${VERSION} \
  -t ${REGISTRY}/web:prod-latest \
  --target=runtime \
  --build-arg VITE_API_BASE_URL=https://api.sportivox.com \
  -f frontend/Dockerfile \
  ./frontend

# Push images
echo "📤 Pushing images to Artifact Registry..."
echo "   Pushing API image..."
docker push ${REGISTRY}/api:${VERSION}
docker push ${REGISTRY}/api:prod-latest

echo "   Pushing Web image..."
docker push ${REGISTRY}/web:${VERSION}
docker push ${REGISTRY}/web:prod-latest

# Verify push
echo "✅ Images pushed successfully"
echo ""
echo "📝 Image URLs:"
echo "   API:  ${REGISTRY}/api:${VERSION}"
echo "   Web:  ${REGISTRY}/web:${VERSION}"
echo ""

# Create deployment checklist
echo "📋 Pre-Deployment Checklist:"
echo "   [ ] All secrets are strong and unique"
echo "   [ ] terraform/terraform.tfvars.prod is updated with new image URLs"
echo "   [ ] terraform plan shows expected changes"
echo "   [ ] Backup of current production config is saved"
echo "   [ ] Team is notified of deployment"
echo ""

echo "🚀 Next steps:"
echo "   1. Update terraform/terraform.tfvars.prod with image URLs:"
echo "      - api_image = \"${REGISTRY}/api:${VERSION}\""
echo "      - web_image = \"${REGISTRY}/web:${VERSION}\""
echo ""
echo "   2. Review Terraform plan:"
echo "      cd infra/terraform"
echo "      terraform plan -var-file=terraform.tfvars.prod"
echo ""
echo "   3. Deploy to production:"
echo "      terraform apply -var-file=terraform.tfvars.prod"
echo ""
echo "   4. Verify deployment:"
echo "      gcloud run services describe sportivox-api-prod --region=$REGION"
echo ""
