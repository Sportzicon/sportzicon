# Sportivox — Deployment Guide (GCP)

This is the single, end-to-end guide for taking the Sportivox codebase from a fresh clone to a production-ready deployment on Google Cloud Platform.

Audience: a developer (or DevOps engineer) handed this repo who has not seen it before.
Time budget: ~45 min for first-time deploy. ~3 min for subsequent updates once CI/CD is wired.

---

## Table of contents

1. [What you're deploying](#1-what-youre-deploying)
2. [Prerequisites — install these first](#2-prerequisites--install-these-first)
3. [Get the code & run it locally (sanity check)](#3-get-the-code--run-it-locally-sanity-check)
4. [Set up the GCP project](#4-set-up-the-gcp-project)
5. [Build & push container images](#5-build--push-container-images)
6. [Provision infra with Terraform](#6-provision-infra-with-terraform)
7. [Wire the web app to the real API URL](#7-wire-the-web-app-to-the-real-api-url)
8. [First admin login](#8-first-admin-login)
9. [Set up automatic CI/CD](#9-set-up-automatic-cicd)
10. [Custom domains (optional)](#10-custom-domains-optional)
11. [Day-2 operations — updates, rollback, monitoring, backups](#11-day-2-operations)
12. [Cost expectations](#12-cost-expectations)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What you're deploying

| Component | Tech | Where it runs |
|-----------|------|--------------|
| API | Node.js 20 + Express + TypeScript | Cloud Run (autoscaling, scale-to-zero) |
| Web app | React 18 + Vite, served by nginx | Cloud Run (autoscaling, scale-to-zero) |
| Database | Firestore Native | Managed by GCP |
| File storage | GCS, two buckets (public media + private docs) | Managed by GCP |
| Secrets | JWT secrets, OpenAI key, SendGrid key | Secret Manager |
| Image registry | Container images | Artifact Registry |
| CI/CD | Cloud Build or GitHub Actions | Either works |

Everything is codified in Terraform under `infra/terraform/`. Nothing is created click-by-click in the GCP Console.

---

## 2. Prerequisites — install these first

### Tools (developer's local machine)

| Tool | Min version | Install |
|------|-------------|---------|
| Git | any recent | `brew install git` / `apt install git` |
| Node.js | 20.x | <https://nodejs.org> (or `nvm install 20`) |
| Docker | 24+ with daemon running | <https://docs.docker.com/get-docker/> |
| gcloud CLI | 470+ | <https://cloud.google.com/sdk/docs/install> |
| Terraform | 1.6+ | <https://developer.hashicorp.com/terraform/install> |
| GitHub CLI (optional, for CI setup) | any recent | `brew install gh` |
| Make (optional) | any | comes with macOS / `apt install make` |

Verify everything:

```bash
node --version       # v20.x
docker --version
gcloud --version
terraform --version  # 1.6+
```

### Accounts you need

1. **GCP account** with billing enabled. Free tier covers most of the cost initially.
2. **OpenAI API key** (optional — needed only if you want AI tips to use real GPT).
3. **SendGrid account** (optional — without it, email-verification links are logged but not sent).
4. **GitHub account** (for CI/CD if using GitHub Actions).
5. **Domain name** (optional, for production URLs like `app.sportivox.com`).

### GCP project (do this once)

If you don't already have a project:

```bash
gcloud auth login
gcloud projects create sportivox-prod --name="Sportivox"
gcloud config set project sportivox-prod

# Link a billing account (replace with yours)
gcloud beta billing accounts list
gcloud beta billing projects link sportivox-prod --billing-account=XXXXXX-XXXXXX-XXXXXX
```

> If using an existing project, just `gcloud config set project <id>` and confirm billing is enabled in the GCP Console.

Authenticate Terraform and gcloud:

```bash
gcloud auth application-default login
```

---

## 3. Get the code & run it locally (sanity check)

This step is optional but recommended: confirm everything works on your laptop before deploying.

```bash
git clone https://github.com/vrkeesara15/sportivox.git
cd sportivox

# Install deps (~1 min)
make install
```

Start the local stack — Docker spins up the Firestore emulator, a GCS emulator, the API, and the web app:

```bash
make dev
```

Wait for the logs to show `Sportivox API listening` and `VITE ready`. Then in a second terminal:

```bash
# (Optional) Seed demo data
docker compose exec api npm run seed
```

Visit <http://localhost:5173> and sign in with any seeded account using password `Demo1234!`:

- `admin@sportivox.local` — admin role
- `athlete@demo.sportivox` — athlete
- `club@demo.sportivox` — club
- `scout@demo.sportivox` — scout

If this works end-to-end, you're good to deploy. `Ctrl+C` to stop the stack.

---

## 4. Set up the GCP project

### Enable required APIs

Terraform enables these automatically, but pre-enabling once speeds up the first apply:

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  iamcredentials.googleapis.com
```

### Create the Artifact Registry repo (needed before the first image push)

Terraform also creates this, but we need it to exist before we push images — chicken-and-egg. Just create it manually once:

```bash
gcloud artifacts repositories create sportivox \
  --repository-format=docker \
  --location=asia-south1 \
  --description="Sportivox container images"
```

> Pick a region close to your users. `asia-south1` = Mumbai, `us-central1` = Iowa, `europe-west1` = Belgium. Whatever you pick, **use the same region** for every later step.

Configure docker to push to it:

```bash
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

---

## 5. Build & push container images

You have two options. Use whichever you prefer.

### Option A — Cloud Build (recommended, runs on Google infrastructure)

From the repo root:

```bash
# Replace asia-south1 with your region everywhere if you picked a different one.
# _API_PUBLIC_URL and _WEB_APP_URL are placeholders for the first build —
# we'll update them after the Cloud Run services exist.

gcloud builds submit . --config infra/cloudbuild.yaml \
  --substitutions=\
_REGION=asia-south1,\
_AR_REPO=sportivox,\
_API_SERVICE=sportivox-api-prod,\
_WEB_SERVICE=sportivox-web-prod,\
_API_PUBLIC_URL=https://placeholder.example.com,\
_WEB_APP_URL=https://placeholder.example.com
```

This will fail at the **deploy** step on the first run because the Cloud Run services don't exist yet — that's fine. The images get pushed before deploy is attempted. Verify:

```bash
gcloud artifacts docker images list asia-south1-docker.pkg.dev/$(gcloud config get-value project)/sportivox
```

You should see `api:latest` and `web:latest`.

### Option B — Local docker build & push

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION=asia-south1
REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/sportivox

# Backend
docker build --target runtime -t $REGISTRY/api:v1 ./backend
docker push $REGISTRY/api:v1

# Frontend — the API URL is baked in at build time, so first use a placeholder
docker build --target runtime \
  --build-arg VITE_API_BASE_URL=https://placeholder.example.com \
  -t $REGISTRY/web:v1 ./frontend
docker push $REGISTRY/web:v1
```

---

## 6. Provision infra with Terraform

Terraform creates: Firestore + composite indexes, GCS buckets, Secret Manager secrets, Cloud Run services, the runtime service account, and IAM bindings.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
$EDITOR terraform.tfvars
```

Fill in `terraform.tfvars` — minimum required fields:

```hcl
project_id  = "sportivox-prod"           # your GCP project ID
region      = "asia-south1"              # same region as above
env         = "prod"

# These reference the images you just pushed
api_image   = "asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:latest"
web_image   = "asia-south1-docker.pkg.dev/sportivox-prod/sportivox/web:latest"

# Placeholder for now — we'll update after Cloud Run gives us real URLs
web_app_url = "https://placeholder.example.com"

# Optional but recommended on first deploy
bootstrap_admin_email    = "admin@yourcompany.com"
bootstrap_admin_password = "ChangeMeImmediately!2026"

# Leave blank if you don't have keys yet — you can add them later via Secret Manager
openai_api_key   = ""
sendgrid_api_key = ""
```

Initialise and apply:

```bash
terraform init
terraform plan      # review carefully — see what will be created
terraform apply     # type "yes" when prompted
```

First apply takes 3–6 minutes (Firestore database creation + Cloud Run cold start).

When it finishes, capture the outputs:

```bash
terraform output
```

You'll get:

```
api_url      = "https://sportivox-api-prod-xxxxx-uc.a.run.app"
web_url      = "https://sportivox-web-prod-xxxxx-uc.a.run.app"
media_bucket = "sportivox-media-prod-xxxxxx"
docs_bucket  = "sportivox-docs-prod-xxxxxx"
artifact_registry = "asia-south1-docker.pkg.dev/sportivox-prod/sportivox"
runtime_service_account = "sportivox-run-prod@sportivox-prod.iam.gserviceaccount.com"
```

Smoke test the API:

```bash
curl https://sportivox-api-prod-xxxxx-uc.a.run.app/healthz
# {"ok":true,"service":"sportivox-api","env":"production"}
```

Visit the web URL in a browser — you should see the Sportivox landing page, but **login will fail** because the web app was built with a placeholder API URL. Fix that next.

---

## 7. Wire the web app to the real API URL

The web app bakes `VITE_API_BASE_URL` into its bundle at build time. We need to rebuild the web image with the real API URL captured from the previous step.

```bash
cd ../..                                                   # back to repo root
PROJECT_ID=$(gcloud config get-value project)
REGION=asia-south1
REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/sportivox
API_URL=$(cd infra/terraform && terraform output -raw api_url)

docker build --target runtime \
  --build-arg VITE_API_BASE_URL=$API_URL \
  -t $REGISTRY/web:v2 ./frontend
docker push $REGISTRY/web:v2

# Deploy the new image
gcloud run deploy sportivox-web-prod \
  --image=$REGISTRY/web:v2 \
  --region=$REGION
```

Now update `terraform.tfvars` so the **API** knows the real web URL (needed for CORS + email links):

```bash
WEB_URL=$(cd infra/terraform && terraform output -raw web_url)
echo "Update web_app_url in terraform.tfvars to: $WEB_URL"
```

Edit `infra/terraform/terraform.tfvars` so `web_app_url = "<the URL from above>"`, then re-apply:

```bash
cd infra/terraform
terraform apply
```

Cloud Run will roll a new API revision with the corrected `CORS_ORIGINS` and `WEB_APP_URL` env vars. ~30 seconds.

The web app and API are now talking. Visit the web URL and sign up to test.

---

## 8. First admin login

If you set `bootstrap_admin_email` and `bootstrap_admin_password` in `terraform.tfvars`, the API auto-created an admin user on first boot.

1. Open the web app.
2. Click **Sign in**, use those bootstrap credentials.
3. Immediately go to **Account → Change password** and rotate it.
4. Visit **/admin** to access the admin panel.

If you didn't set bootstrap credentials, you can create an admin manually in the Firestore Console (Collections → users → add document with `role: "admin"`, `email_verified: true`, `status: "active"`, and a bcrypt password hash). But it's much simpler to set the bootstrap variables.

---

## 9. Set up automatic CI/CD

So future deploys are one `git push` instead of all of section 5–7.

### Option A — Cloud Build trigger (recommended for GCP-native setups)

```bash
# Connect your GitHub repo to Cloud Build first via the Console:
# https://console.cloud.google.com/cloud-build/triggers
# Click "Create trigger" → "GitHub (Cloud Build GitHub App)" → install + link repo.

gcloud builds triggers create github \
  --name=sportivox-main \
  --repo-name=sportivox \
  --repo-owner=vrkeesara15 \
  --branch-pattern="^main$" \
  --build-config=infra/cloudbuild.yaml \
  --substitutions=\
_REGION=asia-south1,\
_AR_REPO=sportivox,\
_API_SERVICE=sportivox-api-prod,\
_WEB_SERVICE=sportivox-web-prod,\
_API_PUBLIC_URL=<your api URL from terraform output>,\
_WEB_APP_URL=<your web URL from terraform output>
```

Any push to `main` now: builds both images → pushes to Artifact Registry → rolls Cloud Run.

### Option B — GitHub Actions

The repo already includes `.github/workflows/ci.yml` which runs typecheck + tests on every PR. To extend it to actually deploy, you'd add a job that calls `gcloud run deploy`. See the [GitHub docs on Workload Identity Federation](https://github.com/google-github-actions/auth) — that's the correct way to give Actions short-lived GCP credentials without storing a service-account JSON in a repo secret.

The repo doesn't ship the deploy workflow because Workload Identity setup is org-specific. Add it when you're ready.

---

## 10. Custom domains (optional)

By default Cloud Run gives you ugly `*.run.app` URLs. Map a domain:

```bash
# Verify domain ownership first in Google Search Console
gcloud domains list-user-verified

gcloud beta run domain-mappings create \
  --service=sportivox-web-prod \
  --domain=app.sportivox.com \
  --region=asia-south1

gcloud beta run domain-mappings create \
  --service=sportivox-api-prod \
  --domain=api.sportivox.com \
  --region=asia-south1
```

Then add the DNS records gcloud prints to your DNS provider. SSL certificates are issued automatically (Let's Encrypt) — takes ~15 min.

After DNS propagates:

1. Rebuild the web image with the new API URL: `--build-arg VITE_API_BASE_URL=https://api.sportivox.com`.
2. Update `web_app_url` in `terraform.tfvars` to `https://app.sportivox.com`.
3. `terraform apply`.

---

## 11. Day-2 operations

### Deploying a code update

If CI is wired up: `git push origin main`. That's it.

Otherwise, manually:

```bash
# Same commands as section 5 + new image tag
gcloud builds submit . --config infra/cloudbuild.yaml --substitutions=...
```

### Rolling back

Cloud Run keeps every revision. Roll back to a previous one:

```bash
gcloud run services update-traffic sportivox-api-prod \
  --to-revisions=sportivox-api-prod-00007-abc=100 \
  --region=asia-south1
```

Find revision names with `gcloud run revisions list --service=sportivox-api-prod --region=asia-south1`.

### Canary releases

```bash
# Split traffic: 90% to current, 10% to new revision
gcloud run services update-traffic sportivox-api-prod \
  --to-revisions=sportivox-api-prod-00008-xyz=10,sportivox-api-prod-00007-abc=90 \
  --region=asia-south1
```

### Monitoring & logs

- **Logs**: <https://console.cloud.google.com/logs> — filter `resource.type="cloud_run_revision"`.
- **Metrics**: <https://console.cloud.google.com/run> → click a service → "Metrics" tab.
- **Alerts**: set up in Cloud Monitoring on `request_count{response_code_class="5xx"}` and `request_latencies` p95.
- **Cost dashboard**: <https://console.cloud.google.com/billing/reports>.

### Rotating secrets

JWT secrets are random-generated by Terraform. To rotate:

```bash
cd infra/terraform
terraform taint random_password.jwt_access
terraform taint random_password.jwt_refresh
terraform apply
```

> Heads up: every user gets logged out because the old refresh tokens become invalid. Plan accordingly.

To rotate the OpenAI / SendGrid keys, update `terraform.tfvars` and `terraform apply`.

### Database backups

**Not automated.** Add a Cloud Scheduler job:

```bash
# Create a backup bucket first
gsutil mb -l asia-south1 gs://sportivox-firestore-backups

# Daily backup at 2am UTC
gcloud scheduler jobs create http firestore-backup \
  --schedule="0 2 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/$(gcloud config get-value project)/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email=$(cd infra/terraform && terraform output -raw runtime_service_account) \
  --message-body='{"outputUriPrefix":"gs://sportivox-firestore-backups"}' \
  --time-zone="UTC"
```

Restore from a backup:

```bash
gcloud firestore import gs://sportivox-firestore-backups/2026-05-18T02:00:00_12345
```

---

## 12. Cost expectations

With Cloud Run scale-to-zero and minimal traffic:

| Component | Idle cost | At 5k MAU / 50k req/day |
|-----------|-----------|--------------------------|
| Cloud Run (api + web) | $0 | ~$15 |
| Firestore | $0 (free tier) | ~$8 |
| GCS (media + docs) | ~$0.05 | ~$3 |
| Secret Manager (~5 active versions) | ~$0.30 | $0.30 |
| Artifact Registry storage | ~$0.10 | ~$0.50 |
| Cloud Build (120 free min/day) | $0 | $0–$5 |
| Egress traffic | $0 | varies |
| **Total** | **~$0.50/mo** | **~$30–50/mo** |

OpenAI usage is billed directly to the OpenAI account, not GCP. SendGrid likewise.

To reduce idle cost to truly zero: set `min_instances_api = 0` and `min_instances_web = 0` in `terraform.tfvars` (this is already the default). Cold starts add ~700ms to the first request after idle.

---

## 13. Troubleshooting

### "Cannot find image" on Cloud Run deploy

Check the image was actually pushed:

```bash
gcloud artifacts docker images list asia-south1-docker.pkg.dev/$(gcloud config get-value project)/sportivox
```

Ensure the tag matches what's in `terraform.tfvars` exactly.

### "PERMISSION_DENIED: Cloud Run Admin API" during terraform apply

The APIs need a moment to propagate after enabling. Wait 30 seconds and re-apply.

### CORS errors in the browser console after deploy

Most likely the API has the wrong `WEB_APP_URL` baked in. Confirm:

```bash
gcloud run services describe sportivox-api-prod --region=asia-south1 \
  --format="value(spec.template.spec.containers[0].env)" | grep -i cors
```

Re-run section 7 if the value is wrong.

### Web app loads but login fails with network error

The web app is calling the wrong API URL. Check:

```bash
curl -s https://sportivox-web-prod-xxxxx-uc.a.run.app/assets/index-*.js | grep -o "https://[^\"]*" | head -3
```

If the URL printed there isn't your real API URL, rebuild the web image (section 7).

### "Firestore: missing index" errors in the API logs

Composite indexes are part of Terraform — if `terraform apply` succeeded they should all exist. Indexes take 5–10 minutes to **build** after creation; queries return errors during that window. Wait, or check status in <https://console.cloud.google.com/firestore/indexes>.

### Email verification links go nowhere

Either `SENDGRID_API_KEY` isn't set (look in Secret Manager) or `WEB_APP_URL` doesn't match the actual web URL. The email is sent regardless, but the link won't work.

### "OPENAI_API_KEY is not configured" when an athlete clicks Get tips

Set the OpenAI key in Secret Manager (or in `terraform.tfvars` and re-apply). Without a key, the API serves stub tips — that's by design.

### Tests fail in CI

CI runs against a real Firestore emulator. Locally the same suite needs Docker running. Either start Docker (`open -a Docker`) or skip backend tests locally and let CI run them.

### `terraform destroy` fails on GCS buckets

The buckets have `force_destroy = false` to prevent accidental data loss. Empty them first:

```bash
gsutil -m rm -r gs://sportivox-media-prod-*/**
gsutil -m rm -r gs://sportivox-docs-prod-*/**
terraform destroy
```

---

## Quick reference — common commands

```bash
# Tail API logs
gcloud run services logs read sportivox-api-prod --region=asia-south1 --limit=200

# Tail web logs
gcloud run services logs read sportivox-web-prod --region=asia-south1 --limit=200

# Restart all api instances (force new revision with same image)
gcloud run services update sportivox-api-prod --region=asia-south1 --update-labels=restart=$(date +%s)

# View current env on a service
gcloud run services describe sportivox-api-prod --region=asia-south1

# List Cloud Run services
gcloud run services list --region=asia-south1

# Open the Firestore data viewer
open https://console.cloud.google.com/firestore/data
```

---

## Handoff checklist for the developer taking over

- [ ] All tools from section 2 installed.
- [ ] Cloned the repo, ran `make install`, ran `make dev`, verified local stack works.
- [ ] GCP project created with billing enabled.
- [ ] APIs enabled, Artifact Registry repo exists, docker configured for the registry.
- [ ] First image push completed; images visible in Artifact Registry.
- [ ] `terraform apply` succeeded; outputs captured.
- [ ] Web image rebuilt with the real API URL; `terraform apply` re-run with the real web URL.
- [ ] Bootstrap admin signed in successfully, password rotated.
- [ ] CI/CD trigger created (Cloud Build or GitHub Actions).
- [ ] (Optional) Custom domains mapped + DNS propagated.
- [ ] (Recommended) Firestore daily backup scheduler created.
- [ ] (Recommended) Cloud Monitoring alerts for 5xx and p95 latency configured.
- [ ] Familiar with rollback / canary commands in section 11.

When this list is fully ticked, the deployment is production-ready and the developer can take over day-to-day operations.
