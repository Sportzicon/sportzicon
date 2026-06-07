# GCP Cloud SQL Database - Quick Start (10 Minutes)

## ⚡ Fastest Way to Setup Database

### Step 1: Enable APIs (1 minute)

```bash
gcloud services enable sqladmin.googleapis.com
```

### Step 2: Create Database Instance (1 minute)

```bash
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"

gcloud sql instances create sportivox-postgres-prod \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --deletion-protection \
  --require-ssl
```

Wait for ~5 minutes for instance to initialize...

### Step 3: Create Database (1 minute)

```bash
gcloud sql databases create sportivox \
  --instance=sportivox-postgres-prod \
  --charset=UTF8
```

### Step 4: Create User & Get Password (1 minute)

```bash
# Generate password
PASSWORD=$(openssl rand -base64 32)
echo "SAVE THIS PASSWORD: $PASSWORD"

# Create user
gcloud sql users create sportivox \
  --instance=sportivox-postgres-prod \
  --password=$PASSWORD
```

### Step 5: Get Connection String (1 minute)

```bash
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres-prod \
  --format='value(ipAddresses[0].ipAddress)')

echo "DATABASE_URL=postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"
```

### Step 6: Add to GitHub Secrets (1 minute)

1. Go to: GitHub repo → Settings → Secrets and variables
2. Click "New repository secret"
3. Name: `DATABASE_URL`
4. Value: `postgresql://sportivox:PASSWORD@IP:5432/sportivox`
5. Click "Add secret"

### Step 7: Run Migrations (1 minute)

```bash
export DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

cd database
npm ci
npx prisma migrate deploy

echo "✓ Database ready!"
```

---

## ✅ Done!

Your database is now:
- ✅ Created in GCP
- ✅ Secured with SSL
- ✅ Backed up automatically
- ✅ High availability (regional)
- ✅ Configured in GitHub Secrets
- ✅ Migrated and ready for use

---

## Next: Deploy to Cloud Run

Push to main branch:
```bash
git push origin main
# GitHub Actions automatically deploys with your new database!
```

---

## Troubleshooting

### Instance creation stuck?
```bash
gcloud sql operations list --instance=sportivox-postgres-prod
```

### Can't connect from Cloud Run?
Make sure service account has `roles/cloudsql.client` role

### Lost password?
```bash
gcloud sql users set-password sportivox \
  --instance=sportivox-postgres-prod \
  --password=$(openssl rand -base64 32)
```

---

**That's it! Database is ready for production.** 🎉

See `GCP_DATABASE_SETUP.md` for detailed configuration options.
