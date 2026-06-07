# Staging CI/CD Setup Checklist

Complete these steps to enable auto-deploy from GitHub to staging.

## 📋 Quick Reference

- **GCP Project:** `sportivox-main`
- **Artifact Registry:** `sportivox` (asia-south1)
- **GitHub Repo:** https://github.com/sportivox/sportivox-main
- **What it does:** Push to `main` → auto-deploy to Cloud Run

---

## ✅ Setup Steps

### Phase 1: GCP Service Account (5 minutes)

- [ ] Open GCP Console: https://console.cloud.google.com/iam-admin/serviceaccounts?project=sportivox-main
- [ ] Click "Create Service Account"
- [ ] Name: `github-actions`
- [ ] Click "Create and Continue"
- [ ] Add roles:
  - [ ] `roles/artifactregistry.writer`
  - [ ] `roles/run.developer`
  - [ ] `roles/iam.serviceAccountUser`
  - [ ] `roles/storage.admin`
- [ ] Click "Continue" → "Done"
- [ ] Click on `github-actions` service account
- [ ] Go to "Keys" tab
- [ ] Click "Add Key" → "Create new key"
- [ ] Choose "JSON" → "Create"
- [ ] **Save the downloaded JSON file** (you'll need it next)

### Phase 2: GitHub Secrets (3 minutes)

- [ ] Open GitHub Secrets: https://github.com/sportivox/sportivox-main/settings/secrets/actions
- [ ] Click "New repository secret"
  - [ ] Name: `GCP_SA_KEY`
  - [ ] Value: (Copy the entire JSON file content from Phase 1)
  - [ ] Click "Add secret"
- [ ] Click "New repository secret" again
  - [ ] Name: `GCP_PROJECT_ID`
  - [ ] Value: `sportivox-main`
  - [ ] Click "Add secret"
- [ ] Verify both secrets appear in the list

### Phase 3: Terraform Backend Setup (5 minutes)

- [ ] Open Terminal
- [ ] Run these commands:
  ```bash
  export PROJECT_ID=sportivox-main
  gsutil mb gs://sportivox-terraform-state-${PROJECT_ID}
  gsutil versioning set on gs://sportivox-terraform-state-${PROJECT_ID}
  ```
- [ ] If errors, authenticate first:
  ```bash
  gcloud auth login
  gcloud config set project sportivox-main
  ```

### Phase 4: Review Terraform Variables (1 minute)

- [ ] File already exists: `infra/terraform/terraform.tfvars.staging`
- [ ] Review it (optional):
  ```bash
  cat infra/terraform/terraform.tfvars.staging
  ```
- [ ] If you need to customize:
  - [ ] Update `api_public_url` and `web_app_url` (or leave as-is for Cloud Run auto-generated URLs)
  - [ ] Adjust `api_min_instances` / `api_max_instances` if needed
- [ ] This file IS committed to Git (safe staging values only)

### Phase 5: Initialize Terraform (2 minutes)

- [ ] Run:
  ```bash
  cd infra/terraform
  terraform init
  ```
- [ ] When prompted "copy existing state to the new backend?" → Type `yes`
- [ ] When done, return to root:
  ```bash
  cd ../..
  ```

### Phase 6: Test Deployment (5 minutes)

- [ ] Make a small commit to main:
  ```bash
  git checkout main
  git pull origin main
  echo "# CI/CD test" >> README.md
  git add README.md
  git commit -m "test: verify CI/CD pipeline"
  git push origin main
  ```
- [ ] Watch workflow: https://github.com/sportivox/sportivox-main/actions
- [ ] Wait for "Deploy to Staging" workflow to complete
- [ ] Check for ✅ green checkmark (success) or ❌ red X (failure)

### Phase 7: Verify Deployed App (2 minutes)

- [ ] Check Cloud Run: https://console.cloud.google.com/run?project=sportivox-main
- [ ] You should see `sportivox-api-staging` and `sportivox-web-staging` running
- [ ] Click on API service to see the Cloud Run URL
- [ ] Test the API health:
  ```bash
  curl https://sportivox-api-staging-XXXX.run.app/health
  ```
- [ ] You should see: `{"status":"ok"}`

---

## 🎉 Success!

If you see green checkmarks and the app is deployed, you're done! 

**What now:**
- Every push to `main` will automatically:
  1. Run tests
  2. Build Docker images
  3. Push to Artifact Registry
  4. Deploy to Cloud Run

- Test the app at the deployed URL
- When you're ready, we'll set up production

---

## 🚨 If Something Fails

**Workflow error?** 
- Click on the workflow in GitHub Actions
- Look at the red error logs
- Refer to docs/CI_CD_SETUP.md "Troubleshooting" section

**Can't find Artifact Registry or Cloud Run?**
- Open: https://console.cloud.google.com/?project=sportivox-main
- Search for "Artifact Registry" or "Cloud Run"

**Need help?**
- Check the detailed guide: `docs/CI_CD_SETUP.md`
- All troubleshooting steps are there

---

## 📝 Important Notes

- ✅ `terraform.tfvars.staging` IS committed (safe staging values only)
- ✅ Never add secrets to `terraform.tfvars.staging` — use GCP Secret Manager instead
- ✅ The JSON service account key is private — treat it like a password
- ✅ Each push to main triggers a deployment (be careful!)
- ✅ You can always rollback by reverting the commit
- ✅ GitHub Actions will update image URLs automatically during deployment

---

**Time to complete:** ~20 minutes (terraform.tfvars.staging is already created!)
**Status:** Ready for staging auto-deploy! 🚀
