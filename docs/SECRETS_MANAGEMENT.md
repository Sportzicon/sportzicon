# Secrets Management Guide

This guide explains how to safely manage secrets (API keys, JWT tokens, passwords) in different environments.

## Overview

Secrets are sensitive credentials that grant access to the application and its services. They must be:
- ✅ Never committed to git
- ✅ Rotated regularly
- ✅ Stored securely (Secret Manager in production)
- ✅ Audited and monitored

## Where Secrets Are Stored

### Local Development

**Files**: `.env.local`, `backend/.env.local`, `frontend/.env.local`

```bash
# These files are in .gitignore - never committed
JWT_ACCESS_SECRET=dev-secret-key
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG...
```

**Security**: 
- Low security needed (dev only)
- Can use weak/placeholder values
- Never share with others (still local)

### Staging Environment

**Files**: `.env.staging` (gitignored), terraform.tfvars.staging (gitignored)

**Storage**: GCP Secret Manager (managed by Terraform)

```bash
# Terraform automatically syncs secrets to Secret Manager
gcloud secrets list  # View all secrets
gcloud secrets versions list JWT_ACCESS_SECRET  # View secret versions
```

**Security**:
- Medium security
- Use strong random values (64+ chars)
- Rotate every 90 days
- Limit access to team members

### Production Environment

**Files**: `.env.production` (gitignored, LOCAL ONLY), terraform.tfvars.prod (gitignored)

**Storage**: GCP Secret Manager (automatically injected by Cloud Run via Terraform)

```bash
# Secrets are version-controlled in Secret Manager
gcloud secrets list --filter='labels.env=prod'

# Cloud Run automatically pulls latest versions
# No secrets in Docker images or code
```

**Security**:
- Highest security
- All secrets must be strong & unique
- Rotate every 30 days
- Full audit trail required
- No local copies (use Secret Manager)

## Required Secrets

### Essential (Always Required)

| Secret | Purpose | Min Length | Rotation |
|--------|---------|-----------|----------|
| `JWT_ACCESS_SECRET` | Auth token signing | 64 chars | 30 days |
| `JWT_REFRESH_SECRET` | Session token signing | 64 chars | 30 days |

### Highly Recommended (For Features)

| Secret | Purpose | Min Length | Rotation |
|--------|---------|-----------|----------|
| `SENDGRID_API_KEY` | Email delivery | 50 chars | 30 days |
| `OPENAI_API_KEY` | AI features | 50 chars | 30 days |

### Optional (For Initial Setup)

| Secret | Purpose | Min Length | Rotation |
|--------|---------|-----------|----------|
| `BOOTSTRAP_ADMIN_PASSWORD` | First-time admin | 12 chars | After first login |

## Generating Secrets

### Strong Random Values

Use a cryptographically secure random generator:

```bash
# Generate 64 random characters (hex)
openssl rand -hex 32

# Generate 64 random characters (base64)
openssl rand -base64 48

# Using Python
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# Using Node.js
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### Example: Generate JWT Secrets

```bash
# Generate two strong secrets for JWT
JWT_ACCESS=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

echo "JWT_ACCESS_SECRET=$JWT_ACCESS" >> .env.production
echo "JWT_REFRESH_SECRET=$JWT_REFRESH" >> .env.production
```

## Managing Secrets Locally

### Setting Up Local Secrets

```bash
# 1. Copy template
cp backend/.env.production.example backend/.env.production

# 2. Generate strong secrets
JWT_ACCESS=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

# 3. Edit file
nano backend/.env.production

# 4. Add secrets
JWT_ACCESS_SECRET=$JWT_ACCESS
JWT_REFRESH_SECRET=$JWT_REFRESH
SENDGRID_API_KEY=your-sendgrid-key
OPENAI_API_KEY=your-openai-key
```

### Using Secrets in Local Development

```bash
# Option 1: Load from .env files (Docker does this automatically)
docker compose --env-file .env.local up

# Option 2: Export as environment variables
export $(cat .env.local | grep -v '#' | xargs)
npm run dev

# Option 3: Use .env file with Node
# Apps using dotenv automatically load from .env
node src/server.js
```

## Managing Secrets in GCP

### Creating Secrets in Secret Manager

```bash
# Create a new secret
gcloud secrets create JWT_ACCESS_SECRET \
  --data-file=secret.txt \
  --labels=env=prod,team=sportivox

# Or from environment variable
echo -n "$JWT_ACCESS" | gcloud secrets create JWT_ACCESS_SECRET --data-file=-

# Create secret with replication policy
gcloud secrets create JWT_REFRESH_SECRET \
  --data-file=secret.txt \
  --replication-policy="automatic"
```

### Viewing Secrets (Auditing)

```bash
# List all secrets
gcloud secrets list

# List specific secret versions
gcloud secrets versions list JWT_ACCESS_SECRET

# View secret details (NOT the value!)
gcloud secrets describe JWT_ACCESS_SECRET

# View access logs
gcloud logging read "resource.type=secretmanager.googleapis.com" --limit=10
```

### Adding New Secret Versions (Rotation)

```bash
# Generate new value
NEW_SECRET=$(openssl rand -hex 32)

# Add as new version
echo -n "$NEW_SECRET" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=-

# Cloud Run automatically uses latest version
# Old versions are kept for rollback

# View all versions
gcloud secrets versions list JWT_ACCESS_SECRET
```

### Granting Access to Secrets

```bash
# Grant service account access
gcloud secrets add-iam-policy-binding JWT_ACCESS_SECRET \
  --member=serviceAccount:sportivox-run-prod@sportivox-prod.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor

# Grant team member access (for debugging)
gcloud secrets add-iam-policy-binding JWT_ACCESS_SECRET \
  --member=user:admin@sportivox.com \
  --role=roles/secretmanager.secretAccessor

# View who has access
gcloud secrets get-iam-policy JWT_ACCESS_SECRET
```

### Revoking Access

```bash
# Remove access from a principal
gcloud secrets remove-iam-policy-binding JWT_ACCESS_SECRET \
  --member=user:departed-employee@company.com \
  --role=roles/secretmanager.secretAccessor
```

## Using Secrets in Application Code

### Backend (Node.js)

Secrets are injected as environment variables by Cloud Run:

```javascript
// backend/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(64),
  JWT_REFRESH_SECRET: z.string().min(64),
  SENDGRID_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

export default env;
```

**Cloud Run injects:** `valueSource.secretKeyRef`
```hcl
# terraform/cloudrun.tf
env {
  name = "JWT_ACCESS_SECRET"
  value_source {
    secret_key_ref {
      secret = google_secret_manager_secret.jwt_access.id
      version = "latest"
    }
  }
}
```

### Never log secrets:

```javascript
// BAD - Don't do this!
console.log('JWT Secret:', process.env.JWT_ACCESS_SECRET);

// GOOD - Log safely
console.log('JWT Secret configured:', !!process.env.JWT_ACCESS_SECRET);
```

### Frontend

Frontend should NOT have secrets. Only non-sensitive config:

```javascript
// frontend/.env.production
VITE_API_BASE_URL=https://api.sportivox.com
VITE_LOG_LEVEL=error

// NOT in frontend:
// VITE_JWT_SECRET=xxx  // ❌ Never!
// VITE_API_KEY=xxx     // ❌ Never!
```

## Rotating Secrets

### Planned Rotation (Recommended)

Every 30 days in production:

```bash
#!/bin/bash
# scripts/rotate-secrets.sh

PROJECT_ID=sportivox-prod

# JWT Secrets
NEW_JWT_ACCESS=$(openssl rand -hex 32)
NEW_JWT_REFRESH=$(openssl rand -hex 32)

# Add new versions to Secret Manager
echo -n "$NEW_JWT_ACCESS" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=-
echo -n "$NEW_JWT_REFRESH" | gcloud secrets versions add JWT_REFRESH_SECRET --data-file=-

# Redeploy Cloud Run to activate
gcloud run deploy sportivox-api-prod --region asia-south1 \
  --image asia-south1-docker.pkg.dev/$PROJECT_ID/sportivox/api:latest

# Log rotation
echo "Rotated JWT secrets at $(date)" >> logs/secret-rotation.log
```

### Emergency Rotation (If Compromised)

1. **IMMEDIATELY**:
   ```bash
   gcloud secrets versions add JWT_ACCESS_SECRET --data-file=new-secret.txt
   gcloud run deploy sportivox-api-prod --region asia-south1 \
     --image asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:latest
   ```

2. **Within 1 hour**:
   - Check Cloud Logging for unauthorized access
   - Check Firestore audit logs
   - Review Cloud Run revision traffic

3. **Within 24 hours**:
   - Rotate SENDGRID_API_KEY if exposed
   - Rotate OPENAI_API_KEY if exposed
   - Force logout all active sessions
   - Post incident review

## Security Best Practices

✅ **DO:**
- Use strong random values (64+ characters)
- Rotate production secrets every 30 days
- Grant minimal required permissions
- Audit secret access in Cloud Logging
- Use separate secrets per environment
- Version secrets in Secret Manager
- Document secret dependencies
- Restrict local secret files to your machine

❌ **DON'T:**
- Commit secrets to git (even accidentally)
- Share secrets in email, chat, or Slack
- Use same secret for dev and production
- Hardcode secrets in Docker images
- Store secrets in environment variables files in git
- Give broad access to secrets
- Ignore audit logs
- Forget to rotate secrets

## Recovering from Secret Leaks

If a secret is exposed:

1. **Stop the leak** (remove from logs, chat, etc.)
2. **Rotate immediately** (new version in Secret Manager)
3. **Audit usage** (check Cloud Logging for unauthorized access)
4. **Investigate** (how was it leaked?)
5. **Document** (write incident report)
6. **Prevent** (improve secret handling)

Example:
```bash
# 1. Create new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Add to Secret Manager
echo -n "$NEW_SECRET" | gcloud secrets versions add JWT_ACCESS_SECRET --data-file=-

# 3. Redeploy Cloud Run
gcloud run deploy sportivox-api-prod --image asia-south1-docker.pkg.dev/sportivox-prod/sportivox/api:latest

# 4. Check who accessed it
gcloud logging read \
  'resource.type="secretmanager.googleapis.com" AND protoPayload.methodName="google.cloud.secretmanager.v1.SecretManagerService.AccessSecretVersion"' \
  --limit=50

# 5. Review for suspicious activity
# 6. Document in incident log
```

## Audit Trail

Monitor secret access:

```bash
# View all secret access
gcloud logging read \
  'resource.type="secretmanager.googleapis.com"' \
  --format=json \
  --limit=100

# Watch for unauthorized access
gcloud alpha events pubsub subscribe \
  "projects/sportivox-prod/topics/secret-access-alerts"

# Set up alert
gcloud monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Unusual secret access" \
  --condition-display-name="Multiple failed secret accesses"
```

## Further Reading

- [GCP Secret Manager Docs](https://cloud.google.com/secret-manager/docs)
- [Cloud Run Security](https://cloud.google.com/run/docs/security)
- [OWASP: Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Terraform Secret Manager Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/secret_manager_secret)
