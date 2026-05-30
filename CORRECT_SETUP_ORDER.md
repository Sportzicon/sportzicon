# ✅ CORRECT SETUP ORDER - Database First!

## The Right Sequence

```
1. DATABASE IN GCP          (STEP 1 - 30 minutes)
   ↓
2. GCP SERVICE ACCOUNT      (STEP 2 - 15 minutes)
   ↓
3. GITHUB SECRETS           (STEP 3 - 5 minutes)
   ↓
4. TERRAFORM SETUP          (STEP 4 - optional, uses IaC)
   ↓
5. CI/CD DEPLOYMENT         (STEP 5 - automatic)
   ↓
6. API IS LIVE              (Final - ~25 minutes)
```

---

## 🗄️ STEP 1: Setup Database in GCP (30 MINUTES)

### Follow: `SETUP_DATABASE_IN_GCP.md`

This guide covers:
- ✅ Create Cloud SQL instance
- ✅ Create database
- ✅ Create user & password
- ✅ Get public IP
- ✅ Test connection
- ✅ Setup pgAdmin
- ✅ Save credentials

**After this step, you have:**
```
DATABASE_URL=postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox
```

**Save this value!** You'll need it for GitHub.

---

## 🔑 STEP 2: Setup GCP Service Account (15 MINUTES)

### Follow: This section below

```bash
PROJECT_ID="your-project-id"

# Step 1: Create service account
gcloud iam service-accounts create terraform-ci \
  --display-name="CI/CD Service Account for Terraform"

# Step 2: Grant roles
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:terraform-ci@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/editor

# Step 3: Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=terraform-ci@$PROJECT_ID.iam.gserviceaccount.com

# Step 4: Encode for GitHub
base64 key.json > key.json.b64

# Step 5: Display the encoded key
cat key.json.b64
```

**Copy the entire encoded output** - this is your `GCP_SA_KEY`

**Keep key.json file safe** - don't commit it!

---

## 🔐 STEP 3: Add GitHub Secrets (5 MINUTES)

Go to: **GitHub repo → Settings → Secrets and variables → Repository secrets**

Click "New repository secret" and add these **5 secrets:**

| Name | Value | From |
|------|-------|------|
| `GCP_PROJECT_ID` | `your-project-id` | Step 2 |
| `GCP_SA_KEY` | `base64 encoded key` | Step 2 |
| `DATABASE_URL` | `postgresql://sportivox:PASSWORD@IP:5432/sportivox` | Step 1 |
| `TF_VAR_REGION` | `us-central1` | Your choice |
| `TF_VAR_ENVIRONMENT` | `prod` | Your choice |

**Each secret:**
1. Click "New repository secret"
2. Enter Name
3. Enter Value
4. Click "Add secret"

---

## 🏗️ STEP 4: Terraform Setup (OPTIONAL)

If you want infrastructure as code (recommended):

```bash
cd terraform

# Initialize
terraform init \
  -backend-config="bucket=sportivox-terraform-state" \
  -backend-config="prefix=sportivox"

# Plan (see what will be created)
terraform plan -out=tfplan

# Apply (create resources)
terraform apply tfplan
```

This creates additional resources via code.

---

## 🚀 STEP 5: Deployment (AUTOMATIC)

```bash
# Push code to main
git push origin main

# GitHub Actions automatically:
# 1. Validates Terraform ✓
# 2. Applies Terraform ✓
# 3. Builds Docker image ✓
# 4. Pushes to registry ✓
# 5. Deploys to Cloud Run ✓
# 6. Verifies health ✓

# Total: ~25 minutes, ZERO manual work
```

---

## 📋 Complete Checklist

### **Before You Start**
- [ ] GCP project created
- [ ] `gcloud` CLI installed
- [ ] GitHub repo ready

### **Step 1: Database (30 min)**
- [ ] Follow `SETUP_DATABASE_IN_GCP.md`
- [ ] Instance running (`RUNNABLE`)
- [ ] Database created
- [ ] User created
- [ ] pgAdmin connected
- [ ] Save `DATABASE_URL`

### **Step 2: Service Account (15 min)**
- [ ] Service account created
- [ ] Roles granted
- [ ] Key created and encoded
- [ ] Save `GCP_SA_KEY`

### **Step 3: GitHub Secrets (5 min)**
- [ ] Add `GCP_PROJECT_ID`
- [ ] Add `GCP_SA_KEY`
- [ ] Add `DATABASE_URL`
- [ ] Add `TF_VAR_REGION`
- [ ] Add `TF_VAR_ENVIRONMENT`

### **Step 4: Deploy**
- [ ] `git push origin main`
- [ ] Watch GitHub Actions
- [ ] Verify API is live

---

## 🎯 Summary

| Step | Task | Time | Required? |
|------|------|------|-----------|
| 1 | Setup Database | 30 min | ✅ YES |
| 2 | Service Account | 15 min | ✅ YES |
| 3 | GitHub Secrets | 5 min | ✅ YES |
| 4 | Terraform | 10 min | ⭕ Optional |
| 5 | Deploy | 25 min | ✅ YES (automatic) |

**Total: 75 minutes minimum**

---

## 📚 Documentation Files

| Step | File | Purpose |
|------|------|---------|
| 1 | `SETUP_DATABASE_IN_GCP.md` | Database setup |
| 2 | This file | Service account |
| 3 | This file | GitHub secrets |
| 4 | `TERRAFORM_SETUP.md` | Infrastructure code |
| 5 | `GITHUB_ACTIONS_READY.md` | Deployment |

---

## 🚀 Ready to Start?

**Begin with:**

```bash
# 1. Read the database setup guide
cat SETUP_DATABASE_IN_GCP.md

# 2. Run the complete setup script OR manually follow steps

# 3. Save your DATABASE_URL

# 4. Create service account (below)

# 5. Add GitHub secrets

# 6. Push to main
git push origin main

# 7. Watch deployment
# Go to: repo → Actions → Terraform Deploy
```

---

## ✅ What You Have After All Steps

✅ Database in GCP (Cloud SQL)
✅ User with password
✅ pgAdmin for management
✅ Service account for CI/CD
✅ GitHub secrets configured
✅ CI/CD pipeline ready
✅ Infrastructure as code (Terraform)
✅ API deployed to Cloud Run
✅ Automatic deployments configured

---

**Start now with Step 1!** 🚀

Follow `SETUP_DATABASE_IN_GCP.md` to get your database running in GCP.

