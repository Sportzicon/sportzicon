# GCP Cloud SQL Database Setup - Complete Guide

## Overview

This guide sets up PostgreSQL 15 on Google Cloud SQL with proper security, backups, and Cloud Run integration.

---

## Step 1: Enable Required APIs

```bash
gcloud services enable sqladmin.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

---

## Step 2: Create Cloud SQL Instance

### Via Terraform (Recommended - Already in terraform/main.tf)

The Terraform configuration automatically creates:
- PostgreSQL 15 instance
- Regional high availability
- Automated backups
- SSL enforcement
- Proper sizing

Just run:
```bash
cd terraform
terraform apply
```

### Via gcloud CLI (Manual)

```bash
gcloud sql instances create sportivox-postgres-prod \
  --database-version=POSTGRES_15 \
  --region=us-central1 \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --database-flags=max_connections=100 \
  --storage-type=PD_SSD \
  --storage-size=20GB \
  --storage-auto-increase \
  --storage-auto-increase-limit=100 \
  --deletion-protection
```

**Parameters explained:**
- `database-version`: PostgreSQL 15
- `region`: us-central1 (change if needed)
- `tier`: db-f1-micro (0.6 GB RAM - development), upgrade for production
- `availability-type`: REGIONAL (high availability)
- `backup-start-time`: 3 AM UTC
- `deletion-protection`: Prevents accidental deletion

---

## Step 3: Configure Instance Settings

### Enable SSL/TLS

```bash
gcloud sql instances patch sportivox-postgres-prod \
  --require-ssl
```

### Configure Backups

```bash
gcloud sql backups-configuration update sportivox-postgres-prod \
  --backup-start-time=03:00 \
  --transaction-log-retention-days=7
```

### View Configuration

```bash
gcloud sql instances describe sportivox-postgres-prod
```

---

## Step 4: Create Database & User

### Create Database

```bash
gcloud sql databases create sportivox \
  --instance=sportivox-postgres-prod \
  --charset=UTF8
```

### Create User with Password

```bash
# Generate random password
PASSWORD=$(openssl rand -base64 32)
echo "Database password: $PASSWORD"

# Create user
gcloud sql users create sportivox \
  --instance=sportivox-postgres-prod \
  --password=$PASSWORD
```

**Save the password!** You'll need it for:
- `DATABASE_URL` environment variable
- Local development
- GitHub Secrets

---

## Step 5: Get Connection Details

### Public IP (Cloud Run Access)

```bash
# Get public IP
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres-prod \
  --format='value(ipAddresses[0].ipAddress)')

echo "Public IP: $PUBLIC_IP"
```

### Connection String

```bash
# Build CONNECTION STRING
PROJECT_ID=$(gcloud config get-value project)
INSTANCE_NAME="sportivox-postgres-prod"
DB_NAME="sportivox"
DB_USER="sportivox"
DB_PASSWORD="YOUR_PASSWORD"

# For Cloud Run (must use public IP or Cloud SQL proxy)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${PUBLIC_IP}:5432/${DB_NAME}"

echo "DATABASE_URL=$DATABASE_URL"
```

---

## Step 6: Add Cloud Run Service Account Permissions

### Get Service Account Email

```bash
SA_EMAIL=$(gcloud iam service-accounts list \
  --format='value(email)' \
  --filter="displayName=sportivox-cloud-run")

echo "Service Account: $SA_EMAIL"
```

### Grant Cloud SQL Client Role

```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:$SA_EMAIL \
  --role=roles/cloudsql.client
```

---

## Step 7: Setup Cloud SQL Proxy (For Cloud Run)

### Option A: Using Cloud SQL Proxy (Recommended)

Add to `terraform/main.tf`:

```hcl
# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  project     = var.project_id
  account_id  = "sportivox-cloud-run"
  display_name = "Service account for Cloud Run"
}

# IAM: Cloud SQL Client
resource "google_project_iam_member" "sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run uses Cloud SQL proxy automatically when using:
# cloudsql-proxy:INSTANCE_CONNECTION_NAME
```

### Option B: Public IP + SSL (Current Setup)

Cloud Run connects via:
```
postgresql://USER:PASSWORD@PUBLIC_IP:5432/DATABASE
```

Security measures:
- ✅ SSL/TLS required
- ✅ IP Allowlist configured
- ✅ Strong password
- ✅ User limited to specific database

---

## Step 8: Configure Firewall & IP Allowlist

### Option A: Allow Only Cloud Run

```bash
# Get Cloud Run service external IP (if static)
# Or use Cloud SQL proxy method (recommended)

# For now, configure in Cloud Console:
# 1. Cloud SQL Instance → Connections
# 2. Public IP → Authorized networks
# 3. Add Cloud Run IP or 0.0.0.0/0 (not secure!)
```

### Option B: Use Cloud SQL Proxy (Better Security)

Update Terraform:

```hcl
resource "google_cloud_run_service" "api" {
  # ... existing config ...
  
  template {
    spec {
      containers {
        # Use Cloud SQL proxy sidecar
        # This avoids needing public IP
      }
    }
  }
}
```

---

## Step 9: Initialize Database Schema

### Run Migrations

```bash
# Set environment variables
export DATABASE_URL="postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox"

# Navigate to database directory
cd database

# Install dependencies
npm ci

# Run migrations
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

### Seed Data (Optional)

```bash
npm run seed
```

---

## Step 10: Verify Connection

### Test from Local Machine

```bash
# Install psql
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client

# Connect to database
psql "postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox"

# In psql:
postgres=# \dt              # List tables
postgres=# \d users         # Describe users table
postgres=# SELECT COUNT(*) FROM users;  # Count users
postgres=# \q              # Quit
```

### Test from Cloud Run

Once deployed, check logs:

```bash
gcloud run services logs read sportivox-api --region=us-central1

# Look for successful connections, no "Connection refused" errors
```

---

## Step 11: Setup Backups & High Availability

### Automated Backups (Already Configured)

```bash
# View backups
gcloud sql backups list --instance=sportivox-postgres-prod

# Take manual backup
gcloud sql backups create \
  --instance=sportivox-postgres-prod \
  --description="Pre-migration backup"

# Restore from backup (if needed)
gcloud sql backups restore BACKUP_ID \
  --backup-instance=sportivox-postgres-prod
```

### Enable High Availability (HA)

If not already configured:

```bash
gcloud sql instances patch sportivox-postgres-prod \
  --availability-type=REGIONAL
```

This creates a standby replica in another zone.

---

## Step 12: Configure Monitoring & Alerts

### View Instance Metrics

```bash
# CPU usage
gcloud monitoring time-series list \
  --filter='metric.type="cloudsql.googleapis.com/database/cpu/utilization"'

# Memory usage
gcloud monitoring time-series list \
  --filter='metric.type="cloudsql.googleapis.com/database/memory/utilization"'

# Network I/O
gcloud monitoring time-series list \
  --filter='metric.type="cloudsql.googleapis.com/database/network/connections"'
```

### Via Cloud Console

1. Go to: Cloud SQL → Instances → sportivox-postgres-prod
2. Click "Monitoring" tab
3. View CPU, Memory, Network, Connections

### Set Alerts

```bash
gcloud alpha monitoring policies create \
  --notification-channels=CHANNEL_ID \
  --display-name="Cloud SQL CPU High" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s
```

---

## Step 13: Setup GitHub Secrets

Add to GitHub (Settings → Secrets and variables):

```
DATABASE_URL = postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox
```

This is automatically used by:
- GitHub Actions workflows
- Cloud Run deployment
- Local testing (optional)

---

## Step 14: Connection String Security

### Sensitive Characters in Password

If password contains special characters like `@`, `#`, `!`, URL-encode them:

```python
# Python example
import urllib.parse
password = "my!@#$%password"
encoded = urllib.parse.quote(password)
# Result: "my%21%40%23%24%25password"

DATABASE_URL = f"postgresql://sportivox:{encoded}@{host}:5432/sportivox"
```

### Never Commit DATABASE_URL

```bash
# Add to .gitignore
echo "DATABASE_URL=" >> backend/.env.example
# but NOT the actual value
```

---

## Troubleshooting

### "Connection refused"

```bash
# 1. Verify instance is running
gcloud sql instances describe sportivox-postgres-prod --format='value(state)'

# 2. Check public IP is authorized
gcloud sql instances describe sportivox-postgres-prod --format='yaml' | grep -A5 ipAddresses

# 3. Verify SSL certificate
gcloud sql ssl-certs list --instance=sportivox-postgres-prod
```

### "Too many connections"

```bash
# Increase max connections
gcloud sql instances patch sportivox-postgres-prod \
  --database-flags=max_connections=500
```

### "Permission denied" for Cloud Run

```bash
# Verify service account has Cloud SQL Client role
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*" \
  --format='table(bindings.role)'
```

### "Database doesn't exist"

```bash
# List databases
gcloud sql databases list --instance=sportivox-postgres-prod

# Create database if missing
gcloud sql databases create sportivox \
  --instance=sportivox-postgres-prod
```

### "User doesn't exist"

```bash
# List users
gcloud sql users list --instance=sportivox-postgres-prod

# Create user if missing
gcloud sql users create sportivox \
  --instance=sportivox-postgres-prod \
  --password=NEW_PASSWORD
```

---

## Cost Optimization

### Downgrade Instance (Development)

For development/staging:

```bash
gcloud sql instances patch sportivox-postgres-prod \
  --tier=db-f1-micro \
  --async
```

### Resize Storage

```bash
gcloud sql instances patch sportivox-postgres-prod \
  --storage-size=50GB
```

### Stop Instance (Temporary)

```bash
# Stop (don't delete!)
gcloud sql instances patch sportivox-postgres-prod \
  --activation-policy=NEVER

# Restart
gcloud sql instances patch sportivox-postgres-prod \
  --activation-policy=ALWAYS
```

---

## Production Checklist

- [ ] Instance created with high availability (REGIONAL)
- [ ] SSL/TLS required
- [ ] Automated backups enabled (daily)
- [ ] Backup retention set (7+ days)
- [ ] Database created
- [ ] User created with strong password
- [ ] IP allowlist configured (or Cloud SQL proxy)
- [ ] Service account has Cloud SQL Client role
- [ ] DATABASE_URL in GitHub Secrets
- [ ] Migrations run successfully
- [ ] Deletion protection enabled
- [ ] Monitoring alerts configured
- [ ] Backup tested (restore to verify)

---

## Monitoring & Maintenance

### Weekly
- Check backup status
- Review error logs
- Monitor disk usage

### Monthly
- Review slow query logs
- Check CPU/Memory trends
- Test backup restoration

### Quarterly
- Review security settings
- Update passwords
- Optimize indexes

---

## Emergency Procedures

### Restore from Backup

```bash
# List backups
gcloud sql backups list --instance=sportivox-postgres-prod

# Restore
gcloud sql backups restore BACKUP_ID \
  --backup-instance=sportivox-postgres-prod
```

### Create Manual Backup Before Major Changes

```bash
gcloud sql backups create \
  --instance=sportivox-postgres-prod \
  --description="Pre-schema-migration backup"
```

### Connect via Cloud Shell (No Public IP)

```bash
gcloud sql connect sportivox-postgres-prod \
  --user=sportivox
```

---

## Security Best Practices

✅ **Implemented:**
- SSL/TLS required
- High availability (regional)
- Automated backups (7 days)
- User with limited permissions
- Service account authentication (Cloud Run)
- Deletion protection

✅ **Optional Enhancements:**
- VPC peering (private IP)
- Cloud SQL proxy (zero public IP exposure)
- Database encryption
- User roles & grants per application
- Connection pooling

---

## Complete Setup Script

```bash
#!/bin/bash

PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
INSTANCE="sportivox-postgres-prod"
DB="sportivox"
USER="sportivox"

echo "Creating Cloud SQL Instance..."
gcloud sql instances create $INSTANCE \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --database-flags=max_connections=100 \
  --deletion-protection

echo "Creating database..."
gcloud sql databases create $DB --instance=$INSTANCE

echo "Creating user..."
PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $USER --instance=$INSTANCE --password=$PASSWORD

echo "Enabling SSL..."
gcloud sql instances patch $INSTANCE --require-ssl

echo "✓ Database setup complete!"
echo ""
echo "Save this password: $PASSWORD"
echo ""
echo "DATABASE_URL=postgresql://${USER}:${PASSWORD}@$(gcloud sql instances describe $INSTANCE --format='value(ipAddresses[0].ipAddress)'):5432/${DB}"
```

---

## Summary

✅ **Setup Complete When:**
- Cloud SQL instance created
- Database created
- User created with password
- SSL enforced
- Migrations run successfully
- SERVICE ACCOUNT has Cloud SQL Client role
- DATABASE_URL in GitHub Secrets
- Backups verified
- Monitoring configured

✅ **Ready for:**
- Cloud Run deployment
- GitHub Actions CI/CD
- Production traffic

