# Environment Setup - Complete Guide

This document summarizes all environment configuration files and how they work together across different deployment environments.

## Philosophy

**One repository. Three environments. Unmixed configurations.**

- ✅ All configuration files are in the repository
- ✅ Actual secrets are gitignored (never committed)
- ✅ Template files (`.*.example`) are committed for reference
- ✅ Each environment loads its own configuration automatically
- ✅ No risk of accidentally deploying dev config to production

## File Structure

### Configuration Files (What's in Git)

```
📁 Sportivox Root
│
├─ 📄 .env.example                      ← Master template (all vars documented)
├─ 📄 .env.*.example                    ← Environment templates
│  ├─ .env.staging.example               ← Staging template
│  └─ .env.production.example             ← Production template
│
├─ 📁 backend/
│  ├─ 📄 .env.example                   ← Backend variables
│  ├─ 📄 .env.production.example         ← Production template
│  └─ 📄 src/config/
│     └─ env.ts                         ← Zod validation schema
│
├─ 📁 frontend/
│  ├─ 📄 .env.example                   ← Frontend variables
│  ├─ 📄 .env.production.example         ← Production template
│  └─ 📄 vite.config.ts                 ← Vite env loading
│
├─ 📁 docs/
│  ├─ 📄 ENVIRONMENT_CONFIG.md          ← Configuration guide
│  ├─ 📄 DEPLOYMENT_SETUP.md            ← Deployment steps
│  └─ 📄 SECRETS_MANAGEMENT.md          ← Secrets best practices
│
├─ 📁 scripts/
│  ├─ 📄 deploy-local.sh                ← Local dev startup
│  ├─ 📄 deploy-staging.sh              ← Build for staging
│  └─ 📄 deploy-prod.sh                 ← Build for production
│
├─ 📁 infra/terraform/
│  ├─ 📄 terraform.tfvars.example       ← Terraform template (uncommitted)
│  ├─ 📄 main.tf                        ← IaC configuration
│  └─ 📄 ...                            ← Other TF files
│
├─ 📄 docker-compose.yml                ← Local dev (emulators)
├─ 📄 docker-compose.prod.yml           ← Prod-like for testing
└─ 📄 Makefile                          ← Development commands
```

### Environment Files (What's NOT in Git)

```
📁 Local Machine Only (.gitignored)
├─ 📄 .env.local                        ← Your local secrets
├─ 📄 backend/.env.local                ← Backend local config
├─ 📄 frontend/.env.local               ← Frontend local config
├─ 📄 .env.staging                      ← Your staging secrets
├─ 📄 infra/terraform/terraform.tfvars.staging
└─ 📄 infra/terraform/terraform.tfvars.prod
```

## How Each Environment Works

### Local Development

**Files used:**
- `.env.local` (root)
- `backend/.env.local`
- `frontend/.env.local`
- `docker-compose.yml`

**How it works:**
```bash
# 1. Docker Compose reads .env.local
docker compose up --build

# 2. Backend loads backend/.env.local
# 3. Frontend loads frontend/.env.local
# 4. Firestore & GCS emulators start automatically
# 5. All services run on localhost
```

**Start with:**
```bash
./scripts/deploy-local.sh
# or
make dev
```

---

### Staging Environment

**Files used:**
- `.env.staging` (local, gitignored)
- `backend/.env.production.example` (reference)
- `frontend/.env.production.example` (reference)
- `docker-compose.prod.yml` (testing only)
- `infra/terraform/terraform.tfvars.staging` (local, gitignored)

**How it works:**
```bash
# 1. Create .env.staging from .env.staging.example
cp .env.staging.example .env.staging
# Add YOUR staging secrets

# 2. Create terraform.tfvars.staging from template
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars.staging
# Update with staging GCP project & image URLs

# 3. Build images (reads .env.staging)
./scripts/deploy-staging.sh

# 4. Deploy to GCP Cloud Run
cd infra/terraform
terraform apply -var-file=terraform.tfvars.staging

# 5. Cloud Run injects secrets from Secret Manager
# Environment variables come from GCP, not .env files
```

**Start with:**
```bash
./scripts/deploy-staging.sh
# Then follow the prompts to deploy with Terraform
```

---

### Production Environment

**Files used:**
- `.env.production` (local, gitignored - production secrets)
- `infra/terraform/terraform.tfvars.prod` (local, gitignored)

**How it works:**
```bash
# 1. Create .env.production from .env.production.example
cp .env.production.example .env.production
# Add YOUR production secrets (strong & unique!)

# 2. Create terraform.tfvars.prod from template
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars.prod
# Update with production GCP project

# 3. Build and push images (reads .env.production for API URL)
VERSION=v1.0.0 ./scripts/deploy-prod.sh

# 4. Deploy to GCP Cloud Run
cd infra/terraform
terraform plan -var-file=terraform.tfvars.prod  # Review first!
terraform apply -var-file=terraform.tfvars.prod

# 5. Cloud Run gets secrets from Secret Manager
# No .env files needed in Cloud Run (Terraform injects secrets)
```

**Start with:**
```bash
VERSION=v1.0.0 ./scripts/deploy-prod.sh
# Follow the prompts to deploy with Terraform
```

---

## Configuration Priority

The app loads configuration in this priority order:

### Backend (Node.js)

1. Environment variables (set by Cloud Run or docker-compose)
2. `.env.local` (local development)
3. Zod schema validation (schema defined in `src/config/env.ts`)

### Frontend (Vite)

1. `VITE_*` environment variables
2. `.env.local` (for local dev)
3. `.env.production` (for production build)
4. Defaults in `vite.config.ts`

**Flow:**
```
Docker Compose → .env file → Environment variables → Application
```

---

## Checklist: Setting Up an Environment

### Local Development Setup

```bash
# Initial setup (one time)
git clone https://github.com/sportivox/sportivox-main.git
cd sportivox-main

# Copy local config
cp .env.example .env.local
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local

# Start development
make dev  # or ./scripts/deploy-local.sh

# Verify
curl http://localhost:8080  # Backend
curl http://localhost:5173  # Frontend
```

### Staging Deployment Setup

```bash
# One-time setup
cp .env.staging.example .env.staging
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars.staging

# Edit files with staging values
nano .env.staging
nano infra/terraform/terraform.tfvars.staging

# Authenticate with GCP
gcloud auth login
gcloud config set project sportivox-staging

# Deploy
./scripts/deploy-staging.sh

# Continue in infra/terraform/
cd infra/terraform
terraform init
terraform plan -var-file=terraform.tfvars.staging
terraform apply -var-file=terraform.tfvars.staging

# Verify
gcloud run services list --region asia-south1
```

### Production Deployment Setup

```bash
# One-time setup
cp .env.production.example .env.production
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars.prod

# Edit files with production values (STRONG SECRETS!)
nano .env.production  # Generate with: openssl rand -hex 32
nano infra/terraform/terraform.tfvars.prod

# Authenticate with GCP
gcloud auth login
gcloud config set project sportivox-prod

# Deploy
VERSION=v1.0.0 ./scripts/deploy-prod.sh

# Continue in infra/terraform/
cd infra/terraform
terraform init
terraform plan -var-file=terraform.tfvars.prod
terraform apply -var-file=terraform.tfvars.prod

# Verify
gcloud run services list --region asia-south1
curl https://api.sportivox.com/health
```

---

## Key Environment Variables Explained

### Required for All Environments

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `NODE_ENV` | `development` | `staging` | `production` |
| `JWT_ACCESS_SECRET` | dev-value | strong-random | strong-random (Secret Manager) |
| `JWT_REFRESH_SECRET` | dev-value | strong-random | strong-random (Secret Manager) |

### Database & Storage

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `FIRESTORE_EMULATOR_HOST` | `firestore:8081` | (empty) | (empty) |
| `STORAGE_EMULATOR_HOST` | `http://gcs:4443` | (empty) | (empty) |
| `GCP_PROJECT_ID` | `sportivox-dev` | your-staging-project | your-prod-project |

### Security & Rate Limiting

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `RATE_LIMIT_MAX` | `1000` | `300` | `100` |
| `AUTH_RATE_LIMIT_MAX` | `50` | `20` | `10` |
| `LOG_LEVEL` | `debug` | `info` | `warn` |

### CORS & URLs

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `CORS_ORIGINS` | `localhost:5173` | `staging.com` | `app.sportivox.com` |
| `PUBLIC_API_URL` | `localhost:8080` | `api-staging.com` | `api.sportivox.com` |

---

## Testing Configuration Changes

### Test Locally Before Staging

```bash
# Edit config
nano .env.local
nano backend/.env.local

# Restart with new config
docker compose down -v
docker compose up --build
```

### Test Production Config Locally

```bash
# Build with production settings
docker compose -f docker-compose.prod.yml up --build

# Verify logs
docker compose logs api
docker compose logs web
```

### Validate Terraform Changes

```bash
cd infra/terraform

# Review what would change
terraform plan -var-file=terraform.tfvars.staging

# Apply when ready
terraform apply -var-file=terraform.tfvars.staging
```

---

## Security Reminders

✅ **DO:**
- Keep `.env.*.local`, `.env.production`, and `terraform.tfvars.*` files in `.gitignore`
- Commit `.env.*.example` and `terraform.tfvars.example` (templates with NO secrets)
- Use strong random values for production secrets
- Rotate production secrets every 30 days
- Use separate GCP projects for staging vs production

❌ **DON'T:**
- Commit actual secret values to git
- Share `.env.production` files
- Use dev secrets in production
- Commit terraform state files (they contain secrets)
- Mix environment files (never use staging config in production)

---

## Troubleshooting

### "Cannot connect to Firestore"

```bash
# Check if emulator is running
curl http://localhost:8081

# Restart emulator
docker compose up firestore -d
```

### "Module not found: .env"

Make sure environment files exist:
```bash
# Local dev
touch .env.local
touch backend/.env.local
touch frontend/.env.local
```

### "Invalid configuration: JWT_ACCESS_SECRET is too short"

```bash
# Generate strong secret (64+ chars)
openssl rand -hex 32

# Add to .env file
echo "JWT_ACCESS_SECRET=$(openssl rand -hex 32)" >> .env.production
```

### "Terraform shows no changes"

```bash
# Force refresh
terraform refresh -var-file=terraform.tfvars.prod
terraform plan -var-file=terraform.tfvars.prod
```

---

## Further Reading

- [Environment Configuration Guide](docs/ENVIRONMENT_CONFIG.md)
- [Deployment Setup Guide](docs/DEPLOYMENT_SETUP.md)
- [Secrets Management Guide](docs/SECRETS_MANAGEMENT.md)
- [Backend Config Code](backend/src/config/env.ts)
- [Terraform Configuration](infra/terraform/)
