# How to Get Credentials for GitHub Actions CI/CD

Follow this guide **step-by-step**. After each step, post your result here and I'll verify it's correct.

---

## Step 1: Create GCP Service Account

### 1.1 Open GCP Console
Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=sportivox-main

You should see this page with "Service Accounts" heading.

**Post a screenshot here when ready →**

---

### 1.2 Click "Create Service Account"
Look for a blue button at the top that says "Create Service Account"

**Post a screenshot after clicking →**

---

### 1.3 Fill Service Account Details

You'll see a form. Fill in:

**Service account name:** `github-actions`
**Service account ID:** (auto-fills, leave it)
**Description:** (optional) "Service account for GitHub Actions CI/CD"

Click **"Create and Continue"**

**Post screenshot of the form filled in →**

---

### 1.4 Add Permissions/Roles

On the "Grant this service account access to project" page, you'll see a dropdown that says "Select a role".

Click the dropdown and **add these roles one by one:**

1. First role: Search for and select `roles/artifactregistry.writer`
   - Click "Add another role" ✚
   
2. Second role: `roles/run.developer`
   - Click "Add another role" ✚
   
3. Third role: `roles/iam.serviceAccountUser`
   - Click "Add another role" ✚
   
4. Fourth role: `roles/storage.admin`

You should see all 4 roles listed.

Click **"Continue"** → **"Done"**

**Post screenshot showing all 4 roles added →**

---

## Step 2: Download the JSON Key

### 2.1 Open Service Account
Go back to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=sportivox-main

Look for the service account named `github-actions` (should be at the bottom)

Click on it to open.

**Post screenshot →**

---

### 2.2 Go to Keys Tab
You'll see tabs at the top. Click the **"Keys"** tab.

**Post screenshot →**

---

### 2.3 Create JSON Key
Click **"Add Key"** button → Select **"Create new key"**

A dialog pops up, choose **"JSON"** → Click **"Create"**

A JSON file will automatically download. **Save it somewhere safe!**

The file name should be something like: `sportivox-XXXXXXX.json`

**Post the filename you got →**

---

### 2.4 View the JSON Content
Open the downloaded JSON file in a text editor (Notepad, VS Code, etc.)

The file should look like:
```json
{
  "type": "service_account",
  "project_id": "sportivox-main",
  "private_key_id": "XXXXXXX",
  "private_key": "-----BEGIN PRIVATE KEY-----\nXXXXX...",
  "client_email": "github-actions@sportivox-main.iam.gserviceaccount.com",
  ...
}
```

**Post the first few lines (just to confirm it exists) →**

---

## Step 3: Add GitHub Secrets

### 3.1 Open GitHub Repository Settings
Go to: https://github.com/sportivox/sportivox-main/settings/secrets/actions

You should see a page titled "Actions secrets and variables"

**Post screenshot →**

---

### 3.2 Create First Secret: GCP_SA_KEY

Click **"New repository secret"** button (green button on the right)

**Name:** `GCP_SA_KEY`

**Value:** Open your JSON file, **copy the ENTIRE contents** (everything inside the { })

Paste it into the "Secret" field

Click **"Add secret"**

**Post screenshot showing the secret name (GCP_SA_KEY) created →**

---

### 3.3 Create Second Secret: GCP_PROJECT_ID

Click **"New repository secret"** again

**Name:** `GCP_PROJECT_ID`

**Value:** `sportivox-main`

Click **"Add secret"**

**Post screenshot showing both secrets created →**

---

## Step 4: Create GCS State Bucket

### 4.1 Open Terminal/Command Prompt

On Windows: Press `Win + R`, type `cmd`, press Enter
On Mac: Open Terminal app

### 4.2 Set Project ID Variable

Type this command and press Enter:

```
gcloud config set project sportivox-main
```

You should see: `Updated property [core/project].`

**Post the output →**

---

### 4.3 Create the Bucket

Type this command and press Enter:

```
gsutil mb gs://sportivox-terraform-state-sportivox-main
```

You should see: `Creating gs://sportivox-terraform-state-sportivox-main/...`

**Post the output →**

---

### 4.4 Enable Versioning

Type this command and press Enter:

```
gsutil versioning set on gs://sportivox-terraform-state-sportivox-main
```

You should see: `Enabling versioning for gs://sportivox-terraform-state-sportivox-main/...`

**Post the output →**

---

### 4.5 Verify Bucket Exists

Type this command and press Enter:

```
gsutil ls gs://sportivox-terraform-state-sportivox-main
```

It should return the bucket path (might be empty, that's OK)

**Post the output →**

---

## Step 5: Test Terraform Init

### 5.1 Navigate to Terraform Directory

Type this and press Enter:

```
cd infra\terraform
```

(On Mac/Linux use forward slash: `cd infra/terraform`)

### 5.2 Run Terraform Init

Type this and press Enter:

```
terraform init
```

It will download some files and then ask:

```
Do you want to copy existing state to the new backend?
```

**Type: `yes` and press Enter**

Wait for it to complete. You should see:

```
Terraform has been successfully configured to use the "gcs" backend.
```

**Post the final output →**

---

## Step 6: Verify Everything

### 6.1 Check GitHub Secrets
Go to: https://github.com/sportivox/sportivox-main/settings/secrets/actions

You should see:
- ✅ `GCP_SA_KEY` (appears as ••••••••)
- ✅ `GCP_PROJECT_ID` (appears as ••••••••)

**Post screenshot →**

---

### 6.2 Check GCS Bucket
Go to: https://console.cloud.google.com/storage?project=sportivox-main

You should see your bucket: `sportivox-terraform-state-sportivox-main`

**Post screenshot →**

---

### 6.3 Check Terraform State
In your terminal, type:

```
terraform state list
```

It should show your existing resources (or say empty)

**Post the output →**

---

## ✅ All Done!

When you've completed all steps and posted screenshots, I'll verify everything is correct and you'll be ready to deploy! 🚀

---

## Troubleshooting

**Command not found: `gcloud`?**
- Download Google Cloud SDK: https://cloud.google.com/sdk/docs/install

**Can't create service account?**
- Make sure you're in the right project: `sportivox-main`
- Check you have "Editor" or "Owner" role in the GCP project

**GitHub secrets not saving?**
- Check you're on the correct repo: `https://github.com/sportivox/sportivox-main`
- Make sure you have Admin access to the repo

**Terraform init fails?**
- Make sure the GCS bucket exists
- Make sure the service account has `roles/storage.admin` role

---

**Ready to start? Begin with Step 1 and post screenshots as you go!** 👇
