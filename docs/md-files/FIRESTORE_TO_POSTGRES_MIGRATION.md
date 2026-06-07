# 🚀 Firestore → PostgreSQL Migration Guide

## Overview

Your app is running on Cloud Run. You're migrating from Firestore to PostgreSQL.

---

## STEP 1: Create PostgreSQL Database in GCP (10 min)

```bash
# Set variables
PROJECT_ID=$(gcloud config get-value project)
REGION="europe-north1"  # Match your Cloud Run region

# Create PostgreSQL instance
gcloud sql instances create sportivox-postgres \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --database-flags=max_connections=100 \
  --deletion-protection \
  --require-ssl

echo "Instance creating... (wait 3-5 minutes)"
```

**Wait for completion:**
```bash
gcloud sql instances describe sportivox-postgres --format='value(state)'
# Should return: RUNNABLE
```

---

## STEP 2: Create Database & User (3 min)

```bash
# Create database
gcloud sql databases create sportivox \
  --instance=sportivox-postgres \
  --charset=UTF8

# Create user with password
PASSWORD=$(openssl rand -base64 32)
echo "Password: $PASSWORD"

gcloud sql users create sportivox \
  --instance=sportivox-postgres \
  --password=$PASSWORD
```

**Save the password!**

---

## STEP 3: Get Connection Details (2 min)

```bash
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres \
  --format='value(ipAddresses[0].ipAddress)')

DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

echo "DATABASE_URL=$DATABASE_URL"
```

---

## STEP 4: Run Prisma Migrations (5 min)

```bash
# Set environment variable
export DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

# Navigate to database directory
cd database

# Install dependencies
npm ci

# Run migrations to create schema
npx prisma migrate deploy

# Verify
npx prisma migrate status
```

**Your PostgreSQL schema is now created!**

---

## STEP 5: Update Cloud Run Environment Variable (5 min)

### Get current Cloud Run service name:
```bash
gcloud run services list --region=europe-north1
# Look for your service name (e.g., sportivox-api or sportivox-web-prod)
```

### Update with DATABASE_URL:
```bash
SERVICE_NAME="sportivox-api"  # or whatever your service is called
REGION="europe-north1"

gcloud run services update $SERVICE_NAME \
  --update-env-vars=DATABASE_URL="$DATABASE_URL" \
  --region=$REGION

echo "✓ Environment variable updated"
```

**Verify update:**
```bash
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format='value(spec.template.spec.containers[0].env[?name==`DATABASE_URL`].value)'
```

---

## STEP 6: Migrate Data from Firestore to PostgreSQL

### Option A: Using Prisma (Recommended)

Create migration script: `migrate-firestore-to-postgres.ts`

```typescript
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { PrismaClient } from "@prisma/client";
import { initializeApp } from "firebase/app";

const prisma = new PrismaClient();

// Initialize Firebase
const firebaseConfig = {
  // Your Firebase config
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateUsers() {
  console.log("Starting user migration...");
  
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    await prisma.user.upsert({
      where: { id: doc.id },
      update: data,
      create: {
        id: doc.id,
        ...data,
      },
    });
    
    count++;
    if (count % 100 === 0) console.log(`Migrated ${count} users`);
  }
  
  console.log(`✓ Migrated ${count} users`);
}

async function migratePosts() {
  console.log("Starting posts migration...");
  
  const postsRef = collection(db, "posts");
  const snapshot = await getDocs(postsRef);
  
  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    await prisma.post.upsert({
      where: { id: doc.id },
      update: data,
      create: {
        id: doc.id,
        ...data,
      },
    });
    
    count++;
    if (count % 100 === 0) console.log(`Migrated ${count} posts`);
  }
  
  console.log(`✓ Migrated ${count} posts`);
}

// Run migrations
async function main() {
  try {
    await migrateUsers();
    await migratePosts();
    // Add other collections...
    console.log("\n✅ Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

**Run migration:**
```bash
export DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

npx ts-node migrate-firestore-to-postgres.ts
```

### Option B: Manual SQL Insert

```sql
-- Connect to PostgreSQL
psql "postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

-- Insert users from data you export from Firestore
INSERT INTO "User" (id, email, name, image) 
VALUES 
  ('user-1', 'user1@example.com', 'User 1', 'image-url'),
  ('user-2', 'user2@example.com', 'User 2', 'image-url');

-- Verify
SELECT COUNT(*) FROM "User";
```

---

## STEP 7: Verify Data (5 min)

```bash
# Connect and check data
psql "postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

# In psql:
SELECT COUNT(*) FROM "User";           -- Check users
SELECT COUNT(*) FROM "Post";           -- Check posts
SELECT COUNT(*) FROM "Comment";        -- Check comments
SELECT COUNT(*) FROM "Follow";         -- Check follows

# See table structure
\d "User"
\d "Post"

\q  # Quit
```

---

## STEP 8: Test API Connection (5 min)

```bash
# Test health endpoint
curl https://your-app-domain/healthz

# Should respond with 200 OK

# Test API endpoint that uses database
curl https://your-app-domain/api/v1/users/me

# Should return user data from PostgreSQL
```

---

## STEP 9: Setup pgAdmin for Management (5 min)

```bash
# Start pgAdmin locally
docker run -p 5050:80 \
  --name pgadmin \
  -e PGADMIN_DEFAULT_EMAIL=admin@sportivox.local \
  -e PGADMIN_DEFAULT_PASSWORD=admin123 \
  -d dpage/pgadmin4

# Open browser: http://localhost:5050
# Login with admin@sportivox.local / admin123

# Register server in pgAdmin:
# Host: $PUBLIC_IP
# Port: 5432
# Database: postgres
# Username: sportivox
# Password: $PASSWORD
# SSL Mode: Require
```

---

## STEP 10: Remove Firestore Code (Optional but Recommended)

Once data is migrated and verified:

```bash
# Remove Firebase dependencies
npm uninstall firebase

# Remove Firestore initialization code from your app
# Remove Firestore service files

# Commit changes
git add -A
git commit -m "feat: switch from Firestore to PostgreSQL"
git push origin main
```

---

## Verification Checklist

- [ ] PostgreSQL instance created (RUNNABLE)
- [ ] Database created (sportivox)
- [ ] User created (sportivox)
- [ ] Migrations run successfully
- [ ] Data migrated from Firestore
- [ ] Cloud Run environment variable updated
- [ ] API health check working
- [ ] Data accessible via API
- [ ] pgAdmin connected and showing data

---

## Troubleshooting

### "Connection refused"
```bash
# Verify instance is running
gcloud sql instances describe sportivox-postgres --format='value(state)'

# Check Cloud Run can reach database
# Add Cloud SQL Client role to service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:YOUR-SERVICE-ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/cloudsql.client
```

### "Database doesn't exist"
```bash
# Recreate database
gcloud sql databases create sportivox \
  --instance=sportivox-postgres
```

### "User doesn't exist"
```bash
# Recreate user
gcloud sql users set-password sportivox \
  --instance=sportivox-postgres \
  --password=$(openssl rand -base64 32)
```

### Data not migrating
```bash
# Check Firestore read permissions
# Verify Prisma schema matches Firestore structure
# Run migration with verbose logging
npx ts-node migrate-firestore-to-postgres.ts --debug
```

---

## Summary

✅ **Done:**
- PostgreSQL instance running in GCP
- Database created with schema
- Data migrated from Firestore
- Cloud Run connected to PostgreSQL
- API using new database
- pgAdmin set up for management

✅ **Next Steps:**
- Monitor API logs for any issues
- Test all features thoroughly
- Keep Firestore as backup temporarily
- Once confirmed working, remove Firestore code
- Update CI/CD to deploy new code

---

## Complete Setup Script

```bash
#!/bin/bash

PROJECT_ID=$(gcloud config get-value project)
REGION="europe-north1"
PASSWORD=$(openssl rand -base64 32)

echo "Creating PostgreSQL instance..."
gcloud sql instances create sportivox-postgres \
  --database-version=POSTGRES_15 \
  --region=$REGION \
  --tier=db-f1-micro \
  --availability-type=REGIONAL \
  --backup-start-time=03:00 \
  --database-flags=max_connections=100 \
  --deletion-protection \
  --require-ssl

echo "Waiting for instance..."
sleep 30

echo "Creating database..."
gcloud sql databases create sportivox \
  --instance=sportivox-postgres \
  --charset=UTF8

echo "Creating user..."
gcloud sql users create sportivox \
  --instance=sportivox-postgres \
  --password=$PASSWORD

echo "Getting connection details..."
PUBLIC_IP=$(gcloud sql instances describe sportivox-postgres \
  --format='value(ipAddresses[0].ipAddress)')

DATABASE_URL="postgresql://sportivox:$PASSWORD@$PUBLIC_IP:5432/sportivox"

echo "✅ Database setup complete!"
echo ""
echo "DATABASE_URL=$DATABASE_URL"
echo ""
echo "Next steps:"
echo "1. Run migrations: DATABASE_URL='$DATABASE_URL' npx prisma migrate deploy"
echo "2. Update Cloud Run: gcloud run services update SERVICE_NAME --update-env-vars=DATABASE_URL='$DATABASE_URL'"
echo "3. Migrate data from Firestore"
echo "4. Test API endpoints"
```

---

**Your database is ready for production!** 🚀

