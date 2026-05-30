# Environment Setup Guide

## Required Environment Variables

### Development (local .env)

Create `backend/.env`:
```env
# Server
NODE_ENV=development
PORT=8080
LOG_LEVEL=debug

# Database
DATABASE_URL=postgresql://sportivox:localdev@localhost:5432/sportivox

# JWT
JWT_ACCESS_SECRET=dev-access-secret-change-me-at-least-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-me-at-least-32-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
BCRYPT_ROUNDS=10

# CORS
CORS_ORIGINS=http://localhost:5173
WEB_APP_URL=http://localhost:5173
PUBLIC_API_URL=http://localhost:8080

# GCS
GCS_BUCKET_MEDIA=sportivox-media-dev
GCS_BUCKET_DOCS=sportivox-docs-dev

# Email (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=google-app-password
EMAIL_FROM=sportivox2026@gmail.com
EMAIL_FROM_NAME=Sportivox

# Admin Bootstrap
BOOTSTRAP_ADMIN_EMAIL=admin@sportivox.local
BOOTSTRAP_ADMIN_PASSWORD=ChangeMe123!

# GCP
GCP_PROJECT_ID=sportivox-dev
```

### Production (GitHub Secrets)

Configure these in GitHub Settings → Secrets and variables → Repository secrets:

```
GCP_PROJECT_ID         → Your GCP project ID
GCP_SA_KEY             → GCP service account JSON key (base64 encoded)
DATABASE_URL           → postgresql://user:pass@host:5432/db
JWT_ACCESS_SECRET      → Random 32+ char string (use: openssl rand -base64 32)
JWT_REFRESH_SECRET     → Random 32+ char string
GMAIL_USER             → your-email@gmail.com
GMAIL_APP_PASSWORD     → Google app password (not your Gmail password!)
EMAIL_FROM             → noreply@yourdomain.com
GCS_BUCKET_MEDIA       → production-media-bucket
GCS_BUCKET_DOCS        → production-docs-bucket
```

## Secret Generation

### JWT Secrets
```bash
# Generate secure random strings (32+ characters)
openssl rand -base64 32
# Or on macOS with openssl:
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Gmail App Password
1. Enable 2-Factor Authentication on your Google account
2. Go to https://myaccount.google.com/apppasswords
3. Select "Mail" and "Windows Computer"
4. Google will generate a 16-character password
5. Use this as `GMAIL_APP_PASSWORD`

### GCP Service Account Key
```bash
# Create service account
gcloud iam service-accounts create sportivox-ci

# Grant necessary roles
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:sportivox-ci@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.admin \
  --role=roles/storage.admin \
  --role=roles/cloudsql.client

# Create and download key
gcloud iam service-accounts keys create key.json \
  --iam-account=sportivox-ci@PROJECT_ID.iam.gserviceaccount.com

# Encode for GitHub secrets
base64 -i key.json
```

## Validation

### Check all required vars are set
```bash
# Development
npm run env:validate

# Or manually:
required_vars=(
  "DATABASE_URL"
  "JWT_ACCESS_SECRET"
  "JWT_REFRESH_SECRET"
  "GMAIL_USER"
  "GMAIL_APP_PASSWORD"
  "EMAIL_FROM"
  "GCP_PROJECT_ID"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERROR: Missing required environment variable: $var"
    exit 1
  fi
done
```

### Verify Secret Lengths
```bash
# JWT secrets should be 32+ characters
echo -n "$JWT_ACCESS_SECRET" | wc -c
# Should output: 32 or more
```

## Docker Secrets (for docker-compose)

Pass secrets to container without .env file:
```bash
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_ACCESS_SECRET="$(openssl rand -base64 32)" \
  -e GMAIL_USER="your-email@gmail.com" \
  -p 8080:8080 \
  sportivox-api:latest
```

## Cloud Run Secrets (Google Secret Manager)

Best practice for production:

```bash
# Create secrets in Google Secret Manager
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
echo -n "$(openssl rand -base64 32)" | gcloud secrets create JWT_ACCESS_SECRET --data-file=-

# Grant Cloud Run service access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:sportivox-api@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Reference in Cloud Run deployment
gcloud run deploy sportivox-api \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest \
  --update-secrets=JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest \
  ...
```

## Troubleshooting

### "Missing required environment variable"
- Check `.env` file exists in `backend/` directory
- Verify variable names match exactly (case-sensitive)
- Ensure no spaces around `=` sign

### "JWT_ACCESS_SECRET must be at least 32 characters"
```bash
# Check length
echo -n "$JWT_ACCESS_SECRET" | wc -c
# Generate new one
openssl rand -base64 32
```

### "ENOENT: no such file or directory" for .env
- Create `backend/.env` from `backend/.env.example`
- Or set variables via environment: `export DATABASE_URL=...`

### "Gmail authentication failed"
- Verify `GMAIL_USER` is correct email
- Check `GMAIL_APP_PASSWORD` (not your Gmail password!)
- Ensure 2FA is enabled on Gmail account
- Verify app password was generated correctly

## Environment Checklist

- [ ] `backend/.env` created (dev only)
- [ ] `DATABASE_URL` points to correct database
- [ ] `JWT_ACCESS_SECRET` is 32+ random characters
- [ ] `JWT_REFRESH_SECRET` is 32+ random characters
- [ ] `GMAIL_USER` is valid Gmail address
- [ ] `GMAIL_APP_PASSWORD` is Google app password (not Gmail password)
- [ ] All 10+ required variables are set
- [ ] `.env` is in `.gitignore` (never commit secrets!)
- [ ] GitHub Secrets configured for CI/CD
- [ ] GCP service account has necessary roles

## Quick Setup (Local Development)

```bash
# 1. Copy example file
cp backend/.env.example backend/.env

# 2. Update with your values
nano backend/.env  # or use your editor

# 3. Verify setup
npm run env:validate  # if this script exists

# 4. Test connection
npm run db:status

# 5. Run locally
docker-compose up
```
