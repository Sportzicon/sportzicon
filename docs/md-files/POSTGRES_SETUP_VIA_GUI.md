# 🖥️ PostgreSQL Setup via Google Cloud Console GUI

## STEP 1: Open Google Cloud Console (1 min)

1. Go to: https://console.cloud.google.com/
2. Make sure your **project** is selected (top left)
3. Look for **Cloud SQL** in the search bar

---

## STEP 2: Create SQL Instance (5 min)

1. **Search for "Cloud SQL"** in the search bar at top
2. Click **Cloud SQL** from results
3. Click **CREATE INSTANCE** button
4. Select **PostgreSQL**

---

## STEP 3: Configure Instance Details (3 min)

Fill in the form with these values:

| Field | Value |
|-------|-------|
| **Instance ID** | `sportivox-postgres` |
| **Password** | (Click **Generate** button for secure password) |
| **Database version** | PostgreSQL 15 |
| **Region** | europe-north1 |
| **Zonal availability** | Multiple zones (for HA) |
| **Machine type** | db-f1-micro |

**SAVE THE PASSWORD GENERATED!** You'll need it later.

Click **CONTINUE**

---

## STEP 4: Customize Connectivity (2 min)

Scroll down and find **Connectivity** section:

1. Check: **Public IP** (enabled by default)
2. Check: **Require SSL**
3. Leave **Private IP** unchecked for now

Click **CREATE INSTANCE**

**Wait 3-5 minutes** for instance to be created...

---

## STEP 5: Verify Instance Created (1 min)

You should see:

```
Instance ID: sportivox-postgres
Status: RUNNING (green checkmark)
```

If you see **CREATING**, wait a bit more.

---

## STEP 6: Get Public IP Address (1 min)

1. Click on **sportivox-postgres** instance
2. Look for **Public IP address** field
3. **Copy this IP address** - you'll need it for DATABASE_URL

Example: `34.123.45.67`

---

## STEP 7: Create Database (2 min)

1. Click **sportivox-postgres** instance
2. Click **DATABASES** tab
3. Click **CREATE DATABASE**
4. Name: `sportivox`
5. Character set: `UTF8`
6. Click **CREATE**

✅ Database created!

---

## STEP 8: Create Database User (2 min)

1. Click **sportivox-postgres** instance
2. Click **USERS** tab
3. Click **CREATE USER**
4. Username: `sportivox`
5. Password: (Use the one from Step 3, or generate new)
6. Click **CREATE**

**COPY THE PASSWORD** if you generated a new one!

---

## STEP 9: Build CONNECTION STRING (1 min)

You now have all the pieces:

```
Username: sportivox
Password: (from Step 3 or 8)
Host: PUBLIC_IP (from Step 6)
Port: 5432
Database: sportivox

DATABASE_URL = postgresql://sportivox:PASSWORD@PUBLIC_IP:5432/sportivox
```

**Example:**
```
postgresql://sportivox:abc123def456@34.123.45.67:5432/sportivox
```

**SAVE THIS!** You'll use it next.

---

## STEP 10: Test Connection via Cloud Shell (2 min)

1. At the top of Google Cloud Console, click **Cloud Shell** button (>_)
2. In the terminal that appears, run:

```bash
psql "postgresql://sportivox:PASSWORD@IP:5432/sportivox"
```

Replace:
- `PASSWORD` with your password
- `IP` with your public IP from Step 6

**You should see:**
```
sportivox=>
```

**Type to test:**
```
SELECT 1;
```

**You should see:**
```
 ?column?
----------
        1
```

**Type to exit:**
```
\q
```

✅ Connection works!

---

## STEP 11: Add GitHub Secret (2 min)

1. Go to your **GitHub repo**
2. Click **Settings** (top menu)
3. Click **Secrets and variables** (left sidebar)
4. Click **Repository secrets**
5. Click **New repository secret**
6. Name: `DATABASE_URL`
7. Value: Paste your `postgresql://...` string from Step 9
8. Click **Add secret**

✅ Secret saved!

---

## STEP 12: Update Cloud Run Service (3 min)

1. Go back to **Google Cloud Console**
2. Search for **Cloud Run**
3. Click your service (e.g., `sportivox-api`)
4. Click **EDIT & DEPLOY NEW REVISION**
5. Scroll down to **Environment variables**
6. Click **ADD VARIABLE**
7. Name: `DATABASE_URL`
8. Value: Paste your `postgresql://...` string
9. Click **DEPLOY**

**Wait 2-3 minutes** for deployment...

✅ Cloud Run updated!

---

## STEP 13: Verify It Works (2 min)

1. Go back to Cloud Run
2. Click your service
3. Find **Service details** section
4. Copy the **Service URL**
5. Test in browser or terminal:

```bash
curl "SERVICE_URL/healthz"
# Should return: {"ok":true,...}
```

✅ Everything works!

---

## 🎯 Summary - What You Created

| Item | Location |
|------|----------|
| **PostgreSQL Instance** | Cloud SQL → sportivox-postgres |
| **Database** | sportivox-postgres → Databases → sportivox |
| **User** | sportivox-postgres → Users → sportivox |
| **GitHub Secret** | GitHub Settings → Secrets → DATABASE_URL |
| **Cloud Run Env Var** | Cloud Run → Edit & Deploy → Environment variables |

---

## 📊 GUI Navigation Quick Reference

```
Google Cloud Console (console.cloud.google.com)
├── Search "Cloud SQL"
│   ├── CREATE INSTANCE
│   │   ├── PostgreSQL 15
│   │   ├── Instance ID: sportivox-postgres
│   │   ├── Region: europe-north1
│   │   └── Machine: db-f1-micro
│   │
│   └── sportivox-postgres (instance)
│       ├── Public IP: 34.123.45.67
│       ├── DATABASES
│       │   └── CREATE DATABASE: sportivox
│       └── USERS
│           └── CREATE USER: sportivox
│
└── Search "Cloud Run"
    └── Your Service
        └── EDIT & DEPLOY
            └── Environment variables
                └── DATABASE_URL
```

---

## ✅ Final Checklist

- [ ] Cloud SQL instance created (`sportivox-postgres`)
- [ ] Instance status: **RUNNING**
- [ ] Public IP copied (e.g., 34.123.45.67)
- [ ] Database created (`sportivox`)
- [ ] User created (`sportivox`)
- [ ] Password saved securely
- [ ] Connection tested via Cloud Shell
- [ ] GitHub Secret added (`DATABASE_URL`)
- [ ] Cloud Run updated with env var
- [ ] Health endpoint returns 200 OK

---

## 🚀 Next Steps

**Push your code to deploy:**

```bash
git add .
git commit -m "feat: add postgres setup"
git push origin main
```

**GitHub Actions will automatically:**
1. Build Docker image
2. Deploy to Cloud Run
3. Your app uses PostgreSQL!

**Takes 5-10 minutes automatically!**

---

## 🆘 Troubleshooting via GUI

### Can't find Cloud SQL?
1. Go to: https://console.cloud.google.com/sql/instances
2. Should go directly to Cloud SQL page

### Can't connect to database?
1. Click instance → **CONNECTIONS** tab
2. Check **Public IP** is enabled
3. Add your IP to allowlist (if needed)

### Forgot password?
1. Click instance → **USERS** tab
2. Click the user
3. Click **CHANGE PASSWORD**

### Lost the connection string?
1. Click instance name
2. Copy **Public IP address**
3. Find **Username** under **USERS** tab
4. Rebuild: `postgresql://USERNAME:PASSWORD@IP:5432/sportivox`

---

**PostgreSQL is now ready via GUI!** 🎉

Everything is set up and connected. Push to main to deploy! 🚀

