# 🗄️ SETUP DATABASE IN GCP - Step-by-Step Guide

## Prerequisites

- GCP Account with billing enabled
- `gcloud` CLI installed
- Already logged in: `gcloud auth login`

---

## STEP 1: Set Project ID (2 minutes)

```bash
# Set your project ID
PROJECT_ID="your-project-id"
REGION="us-central1"

# Verify project
gcloud config get-value project

# If different, set it:
gcloud config set project $PROJECT_ID
```

**Verify:**
```bash
gcloud projects describe $PROJECT_ID
# Should show your project details
```

---

## STEP 2: Enable Cloud SQL API (2 minutes)

```bash
echo "Enabling Cloud SQL API..."
gcloud services enable sqladmin.googleapis.com

# Verify
gcloud services list --enabled | grep sqladmin
# Should show: sqladmin.googleapis.com
```

---

## STEP 3: Create Cloud SQL Instance (5 minutes)

```bash
# Create PostgreSQL instance
gcloud sql instances create sportivox-postgres-prod \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --database-flags=max_connections=100 \
  --deletion-protection

echo "Creating instance... (this takes 3-5 minutes)"
```

**Wait for completion** - You'll see:
```
Creating Cloud SQL instance... done.
NAME: sportivox-postgres-prod
STATUS: RUNNABLE
```

**Verify:**
```bash
gcloud sql instances describe sportivox-postgres-prod --format='value(state)'
# Should return: RUNNABLE
```

---

## STEP 4: Require SSL (1 minute)

```bash
echo "Enabling SSL..."
gcloud sql instances patch sportivox-postgres-prod \
  --require-ssl

echo "✓ SSL enabled"
```

---

## STEP 5: Create Database (1 minute)

```bash
echo "Creating database 'sportivox'..."
gcloud sql databases create sportivox \
  --instance=sportivox-postgres-prod \
  --charset=UTF8

echo "✓ Database created"

# Verify
gcloud sql databases list --instance=sportivox-postgres-prod
# Should show: sportivox
```

---

## STEP 6: Create Database User (1 minute)

```bash
# Generate a random secure password
PASSWORD=$(openssl rand -base64 32)

echo "Generated password: $PASSWORD"
echo "SAVE THIS PASSWORD SOMEWHERE SAFE!"
echo ""

# Create user
echo "Creating database user 'sportivox'..."
gcloud sql users create sportivox \
  --instance=sportivox-postgres-prod \
  --password=$PASSWORD

echo "✓ User created"

# Verify
gcloud sql users list --instance=sportivox-postgres-prod
# Should show: sportivox
```

**⚠️ IMPORTANT:** Save the password! You'll need it next.

---

## STEP 7: Get Public IP Address (1 minute)

```bash
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres-prod \
  --format='value(ipAddresses[0].ipAddress)')

echo "Public IP: $PUBLIC_IP"
echo ""

# Build connection string
echo "DATABASE_URL=postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"
echo ""
echo "Copy the DATABASE_URL above!"
```

**You now have:**
- 🔐 Username: `sportivox`
- 🔐 Password: `$PASSWORD`
- 📍 Host: `$PUBLIC_IP`
- 📍 Port: `5432`
- 📍 Database: `sportivox`

---

## STEP 8: Configure IP Allowlist (2 minutes)

**For Cloud Run (later):**

No need to configure now - Cloud SQL proxy handles it automatically.

**For local pgAdmin access:**

```bash
# Get your local IP (if testing locally)
LOCAL_IP=$(curl -s https://api.ipify.org)
echo "Your IP: $LOCAL_IP"

# Add to allowlist (optional, for local testing)
gcloud sql instances patch sportivox-postgres-prod \
  --allowed-networks=$LOCAL_IP

# Or allow all (NOT RECOMMENDED for production):
# gcloud sql instances patch sportivox-postgres-prod \
#   --allowed-networks=0.0.0.0/0
```

---

## STEP 9: Test Connection (3 minutes)

### Option A: Test from Cloud Shell (Easiest)

```bash
gcloud sql connect sportivox-postgres-prod \
  --user=sportivox

# When prompted, enter password (from STEP 6)
# You should see: psql (15.x)

# In psql, run:
SELECT version();
\q  # To quit
```

### Option B: Test from Local Machine

```bash
# First install postgres client
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql-client
# Windows: Download from postgresql.org

psql "postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

# You should see: sportivox=>
# Run:
SELECT 1;
\q  # To quit
```

**Expected output:**
```
SELECT 1;
 ?column?
----------
        1
(1 row)
```

---

## STEP 10: Run Database Migrations (2 minutes)

```bash
# Set environment variable
export DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

# Navigate to database directory
cd database

# Install dependencies
npm ci

# Run migrations
npx prisma migrate deploy

# You should see:
# Database migrated successfully
```

**Verify migrations:**
```bash
npx prisma migrate status
# Should show: "3 migrations found in prisma/migrations/"
```

---

## STEP 11: Verify Database Schema (1 minute)

```bash
# Connect and check tables
psql "postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

# In psql:
\dt          # List all tables
\d "User"    # Describe User table
SELECT COUNT(*) FROM "User";  # Count users
\q           # Quit
```

**You should see Prisma tables:**
- User
- Account
- Session
- VerificationToken
- Post
- Comment
- etc.

---

## STEP 12: Setup pgAdmin for Management (5 minutes)

```bash
# Start pgAdmin locally via Docker
docker run -p 5050:80 \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@sportivox.local \
  -e PGADMIN_DEFAULT_PASSWORD=admin123 \
  -d dpage/pgadmin4

echo "pgAdmin starting..."
sleep 5

# Open in browser
open http://localhost:5050
# or
# firefox http://localhost:5050
# or
# chrome http://localhost:5050
```

**Login to pgAdmin:**
- Email: `admin@sportivox.local`
- Password: `admin123`

**Add Server in pgAdmin:**
1. Right-click **Servers** → **Register** → **Server**
2. **General Tab:**
   - Name: `Sportivox Cloud SQL`
3. **Connection Tab:**
   - Host: `$PUBLIC_IP`
   - Port: `5432`
   - Database: `postgres`
   - Username: `sportivox`
   - Password: `$PASSWORD`
4. **SSL Tab:**
   - SSL mode: `Require`
5. Click **Save**

**Now you can browse your database in pgAdmin!** 🎉

---

## STEP 13: Save Your Credentials (1 minute)

Create a file to save for later:

```bash
# Create credentials file (DO NOT COMMIT THIS)
cat > database-credentials.txt << EOF
Project ID: $PROJECT_ID
Instance: sportivox-postgres-prod
Region: $REGION

Database: sportivox
Username: sportivox
Password: $PASSWORD

Host (Public IP): $PUBLIC_IP
Port: 5432

Connection String:
DATABASE_URL=postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox

pgAdmin:
- Email: admin@sportivox.local
- Password: admin123
EOF

echo "✓ Credentials saved to database-credentials.txt"
echo "⚠️  Keep this file SAFE and DO NOT COMMIT IT!"
```

**NEVER commit this file to git!**

---

## Complete Script (All Steps At Once)

Save this as `setup-database.sh`:

```bash
#!/bin/bash
set -e

# Configuration
PROJECT_ID="your-project-id"
REGION="us-central1"
INSTANCE_NAME="sportivox-postgres-prod"
DB_NAME="sportivox"
DB_USER="sportivox"

# Set project
gcloud config set project $PROJECT_ID

echo "Starting database setup..."
echo ""

# Step 1: Enable API
echo "1/8 Enabling Cloud SQL API..."
gcloud services enable sqladmin.googleapis.com
sleep 5

# Step 2: Create instance
echo "2/8 Creating Cloud SQL instance..."
gcloud sql instances create $INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --database-flags=max_connections=100 \
  --deletion-protection \
  --quiet
echo "   (waiting for instance to be ready...)"
sleep 30

# Step 3: Enable SSL
echo "3/8 Enabling SSL..."
gcloud sql instances patch $INSTANCE_NAME \
  --require-ssl \
  --quiet

# Step 4: Create database
echo "4/8 Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$INSTANCE_NAME \
  --charset=UTF8 \
  --quiet

# Step 5: Create user
echo "5/8 Creating database user..."
PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DB_USER \
  --instance=$INSTANCE_NAME \
  --password=$PASSWORD \
  --quiet

# Step 6: Get IP
echo "6/8 Getting connection details..."
PUBLIC_IP=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(ipAddresses[0].ipAddress)')

# Step 7: Test connection
echo "7/8 Testing connection..."
gcloud sql connect $INSTANCE_NAME \
  --user=$DB_USER << EOF
SELECT 1;
\q
EOF

# Step 8: Save credentials
echo "8/8 Saving credentials..."
cat > database-credentials.txt << CREDS
DATABASE_URL=postgresql://$DB_USER:$PASSWORD@$PUBLIC_IP:5432/$DB_NAME
CREDS

echo ""
echo "✅ DATABASE SETUP COMPLETE!"
echo ""
echo "Connection details:"
echo "=================="
echo "Host: $PUBLIC_IP"
echo "Port: 5432"
echo "Database: $DB_NAME"
echo "Username: $DB_USER"
echo "Password: $PASSWORD"
echo ""
echo "DATABASE_URL:"
echo "postgresql://$DB_USER:$PASSWORD@$PUBLIC_IP:5432/$DB_NAME"
echo ""
echo "Saved to: database-credentials.txt"
echo "⚠️  DO NOT COMMIT THIS FILE!"
```

**Run it:**
```bash
chmod +x setup-database.sh
./setup-database.sh
```

---

## ✅ Verification Checklist

- [ ] Cloud SQL instance created (`sportivox-postgres-prod`)
- [ ] Instance status: `RUNNABLE`
- [ ] SSL: `Enabled`
- [ ] Database: `sportivox` created
- [ ] User: `sportivox` created
- [ ] Public IP accessible
- [ ] Connection test successful
- [ ] pgAdmin connected and shows tables
- [ ] Credentials saved securely
- [ ] DATABASE_URL formatted correctly

---

## 🚀 Next Steps

Once database is ready:

1. **Add GitHub Secret:**
   - Go to GitHub repo → Settings → Secrets
   - Add: `DATABASE_URL` = your connection string

2. **Setup GCP Service Account:** (see next guide)

3. **Deploy Application:** (via GitHub Actions)

---

## 🆘 Troubleshooting

### Instance creation stuck?
```bash
# Check operations
gcloud sql operations list --instance=sportivox-postgres-prod

# Check instance status
gcloud sql instances describe sportivox-postgres-prod
```

### Connection refused?
```bash
# Verify instance is running
gcloud sql instances describe sportivox-postgres-prod --format='value(state)'
# Should be: RUNNABLE

# Check public IP
gcloud sql instances describe sportivox-postgres-prod --format='value(ipAddresses[0].ipAddress)'
```

### "User doesn't exist"?
```bash
# Recreate user
gcloud sql users set-password sportivox \
  --instance=sportivox-postgres-prod \
  --password=$(openssl rand -base64 32)
```

### "Database doesn't exist"?
```bash
# Recreate database
gcloud sql databases create sportivox \
  --instance=sportivox-postgres-prod
```

---

## 📊 Cost (Estimate)

- **db-f1-micro:** ~$20/month
- **Storage (20GB):** ~$5/month
- **Backup storage:** Included
- **Network:** Minimal

Total: ~$25/month for development

Upgrade `--tier=db-custom-2-7680` for production (~$100+/month)

---

## 🎉 Database is Ready!

You now have:
- ✅ Cloud SQL PostgreSQL 15 running
- ✅ Database & user created
- ✅ SSL encryption enabled
- ✅ Backups configured
- ✅ pgAdmin connected
- ✅ Schema migrated

**Next:** Setup GCP service account for deployment

