#!/bin/bash
# Full one-time project setup script.
# Run this ONCE from GCP Cloud Shell before the first deployment.
# After this completes, every push to main auto-deploys via GitHub Actions.
#
# Prerequisites (all available in GCP Cloud Shell by default):
#   - gcloud CLI (authenticated as project owner)
#   - gh CLI (GitHub CLI) — install if missing: https://cli.github.com
#   - gsutil
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
#
# The script will prompt for required values interactively.

set -euo pipefail

# ─── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "${CYAN}==>${NC} $*"; }
success() { echo -e "${GREEN}✅${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "${RED}❌ $*${NC}"; exit 1; }

# ─── Gather inputs ──────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  Sportivox — One-Time Project Setup"
echo "========================================"
echo ""

read -rp "GCP Project ID (e.g. sportivox-app): " PROJECT_ID
read -rp "GitHub repo (e.g. sportivoxuser/sportivox): " GITHUB_REPO
read -rp "GCP region [asia-south1]: " REGION
REGION="${REGION:-asia-south1}"

echo ""
info "Project  : ${PROJECT_ID}"
info "Repo     : ${GITHUB_REPO}"
info "Region   : ${REGION}"
echo ""
read -rp "Continue? (y/N): " CONFIRM
[[ "${CONFIRM}" =~ ^[Yy]$ ]] || die "Aborted."

# ─── Derived values ─────────────────────────────────────────────────────────
SA_CICD="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"
SA_RUNTIME="sportivox-run-prod@${PROJECT_ID}.iam.gserviceaccount.com"
STATE_BUCKET="sportivox-terraform-state-${PROJECT_ID}"

# ─── Step 1: Enable APIs ─────────────────────────────────────────────────────
info "Step 1/7 — Enabling GCP APIs..."
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
success "APIs enabled"

# ─── Step 2: Create CI/CD service account ───────────────────────────────────
info "Step 2/7 — Creating CI/CD service account..."
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD" \
  --project="${PROJECT_ID}" 2>/dev/null || warn "SA already exists, skipping creation."

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
success "CI/CD SA created and roles granted"

# ─── Step 3: Create runtime service account ──────────────────────────────────
info "Step 3/7 — Creating runtime service account..."
gcloud iam service-accounts create sportivox-run-prod \
  --display-name="Sportivox Cloud Run runtime" \
  --project="${PROJECT_ID}" 2>/dev/null || warn "SA already exists, skipping creation."
success "Runtime SA ready"

# ─── Step 4: Create Terraform state bucket ───────────────────────────────────
info "Step 4/7 — Creating Terraform state bucket..."
gsutil mb -p "${PROJECT_ID}" -l "${REGION}" "gs://${STATE_BUCKET}" 2>/dev/null || warn "Bucket already exists, skipping."
gsutil versioning set on "gs://${STATE_BUCKET}"
success "State bucket ready: gs://${STATE_BUCKET}"

# ─── Step 5: Generate CI/CD SA key ───────────────────────────────────────────
info "Step 5/7 — Generating CI/CD service account key..."
gcloud iam service-accounts keys create /tmp/sa-key.json \
  --iam-account="${SA_CICD}" \
  --project="${PROJECT_ID}"
SA_KEY_B64=$(base64 -w 0 /tmp/sa-key.json)
rm -f /tmp/sa-key.json
success "SA key generated"

# ─── Step 6: Set GitHub Secrets ──────────────────────────────────────────────
info "Step 6/7 — Setting GitHub Secrets..."

# Check gh CLI is installed and authenticated
if ! command -v gh &>/dev/null; then
  warn "GitHub CLI (gh) not found. Install it: https://cli.github.com"
  warn "Then run manually:"
  echo "  gh secret set GCP_PROJECT_ID --body '${PROJECT_ID}' --repo ${GITHUB_REPO}"
  echo "  gh secret set GCP_SA_KEY --body '<base64-key>' --repo ${GITHUB_REPO}"
else
  if ! gh auth status &>/dev/null; then
    info "Logging in to GitHub CLI..."
    gh auth login
  fi
  gh secret set GCP_PROJECT_ID --body "${PROJECT_ID}" --repo "${GITHUB_REPO}"
  gh secret set GCP_SA_KEY     --body "${SA_KEY_B64}" --repo "${GITHUB_REPO}"
  success "GitHub Secrets set: GCP_PROJECT_ID, GCP_SA_KEY"
fi

# ─── Step 7: Verify ──────────────────────────────────────────────────────────
info "Step 7/7 — Verifying setup..."
gcloud iam service-accounts describe "${SA_CICD}" --project="${PROJECT_ID}" &>/dev/null && \
  success "CI/CD SA: ${SA_CICD}"
gcloud iam service-accounts describe "${SA_RUNTIME}" --project="${PROJECT_ID}" &>/dev/null && \
  success "Runtime SA: ${SA_RUNTIME}"
gsutil ls "gs://${STATE_BUCKET}" &>/dev/null && \
  success "State bucket: gs://${STATE_BUCKET}"

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo -e "${GREEN}  Setup complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Push code to main branch:"
echo "     git push https://<username>@github.com/${GITHUB_REPO}.git main"
echo ""
echo "  2. Watch deployment at:"
echo "     https://github.com/${GITHUB_REPO}/actions"
echo ""
echo "  3. After first deployment, seed demo data:"
echo "     cd backend && npm run build"
echo "     GCP_PROJECT_ID=${PROJECT_ID} NODE_ENV=production \\"
echo "       JWT_ACCESS_SECRET=\$(gcloud secrets versions access latest --secret=sportivox-jwt-access-secret-prod --project=${PROJECT_ID}) \\"
echo "       JWT_REFRESH_SECRET=\$(gcloud secrets versions access latest --secret=sportivox-jwt-refresh-secret-prod --project=${PROJECT_ID}) \\"
echo "       node dist/scripts/seed.js"
echo ""
