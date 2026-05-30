# Quick Reference Card

## 🚀 Before You Deploy

```bash
# 1. Test locally
docker-compose down
docker-compose up --build

# 2. Verify health
curl http://localhost:8080/healthz

# 3. Test endpoint
curl http://localhost:8080/api/v1/auth/login

# 4. If OK, commit
git add -A
git commit -m "chore: update deployment config"
git push origin main

# 5. Watch GitHub Actions
# Go to repo → Actions → watch build
```

---

## ⚙️ Setup Checklist (First Time)

### GitHub (5 min)
```bash
# Add these 10 secrets:
# Settings → Secrets and variables → Repository secrets

GCP_PROJECT_ID           # your-project-id
GCP_SA_KEY               # base64 encoded key.json
DATABASE_URL             # postgresql://user:pass@host/db
JWT_ACCESS_SECRET        # 32+ random chars (openssl rand -base64 32)
JWT_REFRESH_SECRET       # 32+ random chars
GMAIL_USER               # your-email@gmail.com
GMAIL_APP_PASSWORD       # google app password (not Gmail password)
EMAIL_FROM               # noreply@domain.com
GCS_BUCKET_MEDIA         # your-bucket-media
GCS_BUCKET_DOCS          # your-bucket-docs
```

### GCP (10 min)
```bash
# Create project
gcloud projects create sportivox-prod

# Enable APIs
gcloud services enable run.googleapis.com sql.googleapis.com storage.googleapis.com

# Create service account
gcloud iam service-accounts create sportivox-ci
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:sportivox-ci@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/run.admin
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:sportivox-ci@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/storage.admin

# Create key
gcloud iam service-accounts keys create key.json \
  --iam-account=sportivox-ci@PROJECT_ID.iam.gserviceaccount.com
```

---

## 🔴 Critical Issues (WILL FAIL)

| Issue | Error | Fix |
|-------|-------|-----|
| Build context | `COPY ../database is outside context` | Change docker-compose `context: .` |
| Missing secrets | API starts but can't connect DB | Add all 10 secrets to GitHub |
| No migrations | Database has no schema | Add migration step to workflow |
| Symlink fails | `ln: operation not permitted` | Already fixed in code ✅ |

---

## 🟡 High-Risk Issues (MAY FAIL)

| Issue | Symptom | Fix |
|-------|---------|-----|
| Port 8080 busy | `EADDRINUSE :::8080` | Kill previous container |
| GCS auth | `GCS authentication failed` | Check GCP service account |
| Prisma engine | `libquery_engine-linux-musl.so.node not found` | Already fixed in Dockerfile ✅ |
| Node modules | Slow builds | Enable Docker cache |

---

## 📋 Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `.github/workflows/deploy.yml` | CI/CD pipeline | Adding new deployment steps |
| `docker-compose.yml` | Local dev setup | Changing ports/services |
| `backend/Dockerfile` | Production image | System dependencies |
| `database/package.json` | Schema version | When updating Prisma |
| `backend/.env` | Local secrets | Daily dev work |
| `.env.example` | Template | Share with team |

---

## 🆘 Emergency Commands

### View logs
```bash
# Local
docker logs sportivox-api-1

# Cloud Run
gcloud run services logs read sportivox-api --limit=100

# Stream logs
gcloud run services logs read sportivox-api --limit=0 --follow
```

### Check status
```bash
# API health
curl https://api.sportivox.com/healthz

# Cloud Run revision
gcloud run services describe sportivox-api
gcloud run revisions list --service=sportivox-api
```

### Rollback
```bash
# Find previous revision
gcloud run revisions list --service=sportivox-api

# Rollback
gcloud run services update-traffic sportivox-api --to-revisions=REVISION_ID=100
```

### Emergency stop
```bash
# Delete bad revision
gcloud run revisions delete REVISION_ID

# Go back to previous
gcloud run services update-traffic sportivox-api --to-revisions=PREV_ID=100
```

---

## ✅ Validation Commands

```bash
# Check Prisma schema
npx prisma validate --schema=database/prisma/schema.prisma

# Check migrations
ls database/prisma/migrations/

# Build Docker image
docker build -f backend/Dockerfile -t test:latest .

# Run tests
cd backend && npm test

# Check TypeScript
npm run typecheck

# Check env vars (if script exists)
npm run env:validate
```

---

## 📊 Monitoring URLs

```
API Health:     https://api.sportivox.com/healthz
Logs:          https://console.cloud.google.com/logs
Cloud Run:     https://console.cloud.google.com/run
Database:      https://console.cloud.google.com/sql
Storage:       https://console.cloud.google.com/storage
GitHub Actions: https://github.com/USERNAME/REPO/actions
```

---

## 🔑 Secret Generation

```bash
# Generate random secret (32+ chars)
openssl rand -base64 32

# Or use Python
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Check length
echo -n "your-secret" | wc -c
```

---

## 📞 Debug Checklist

### "Build context error"
```
1. Check docker-compose.yml: context: .
2. Run: docker build -f backend/Dockerfile .
3. If works locally, push & GitHub Actions will work
```

### "Can't connect to database"
```
1. Check DATABASE_URL in GitHub Secrets
2. Test locally: psql $DATABASE_URL
3. Check if database exists: psql -l
4. Verify credentials are correct
```

### "Prisma generation failed"
```
1. Check Prisma version: npx prisma -v (should be 5.21.0)
2. Check schema: npx prisma validate
3. Check node_modules: rm -rf node_modules && npm ci
4. Try again: npx prisma generate
```

### "API won't start"
```
1. Check health: curl http://localhost:8080/healthz
2. Check logs: docker logs sportivox-api-1
3. Check env vars: docker exec sportivox-api-1 env
4. Check database: npx prisma db execute --stdin < schema.sql
```

### "Health check timeout"
```
1. Increase timeout in Cloud Run (30s → 60s)
2. Check if API is actually starting: docker logs
3. Check if PORT 8080 is correct
4. Check if health endpoint works: curl /healthz locally
```

---

## 🎯 Success Indicators

✅ **Local Dev**
- `docker-compose up` starts without errors
- `curl http://localhost:8080/healthz` returns 200
- Can login at `http://localhost:5173`
- No errors in `docker logs`

✅ **GitHub Actions**
- Build completes (green checkmark)
- No errors in workflow logs
- Image pushed to gcr.io

✅ **Cloud Run**
- Revision is "serving"
- Health check passes
- Traffic is being routed to new revision
- `curl https://api.sportivox.com/healthz` returns 200

✅ **Production**
- No errors in logs
- Response times < 200ms
- Zero database connection errors
- Users can login and use app

---

## 🚨 Failure Indicators

⚠️ **Watch For**
- Build context error (COPY fails)
- Missing environment variable (JSON parse error)
- Database connection refused (cannot connect)
- Prisma client not initialized (schema issue)
- Port already in use (cleanup needed)
- Health check timeout (API not starting)

---

## 📈 Pipeline Speed

| Step | Time | Parallel? |
|------|------|-----------|
| Checkout | 10s | No |
| npm ci (database) | 30s | Yes |
| npm ci (backend) | 45s | Yes |
| Docker build | 120s | No |
| Push to registry | 30s | No |
| Deploy to Cloud Run | 20s | No |
| Health check | 10s | No |
| **Total** | **~4 min** | - |

---

## 💾 Database Backups

```bash
# Backup (production)
gcloud sql backups create --instance=sportivox-db-prod

# List backups
gcloud sql backups list --instance=sportivox-db-prod

# Restore (if needed)
gcloud sql backups restore BACKUP_ID --backup-instance=sportivox-db-prod
```

---

## 🔐 Security Reminders

- ✅ Never commit `.env` file
- ✅ Never log secrets
- ✅ Always use GitHub Secrets for sensitive data
- ✅ Rotate API keys quarterly
- ✅ Use service accounts for CI/CD (not user credentials)
- ✅ Enable Cloud Run IAM restrictions
- ✅ Keep dependencies updated

---

## 📚 Documentation Index

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview |
| `DOCKER_FIXES.md` | Technical deep-dive of each fix |
| `PIPELINE_BLOCKAGES.md` | 10 pipeline issues + solutions |
| `ENV_SETUP.md` | Environment variable guide |
| `DEPLOYMENT_CHECKLIST.md` | Pre/during/post deployment |
| `PIPELINE_FLOW.md` | Visual flow diagrams |
| `QUICK_REFERENCE.md` | This file |

---

## ⏱️ Time Estimates

| Task | Time | Difficulty |
|------|------|-----------|
| Local setup | 15 min | Easy |
| GitHub secrets | 5 min | Easy |
| GCP setup | 20 min | Medium |
| First deployment | 10 min | Easy |
| Troubleshooting | 30 min | Medium |
| Full production setup | 1 hour | Medium |

---

## 🎓 Learning Resources

```bash
# Docker
docker help                    # CLI help
docker ps                      # List containers
docker logs <container>        # View logs
docker exec <container> bash   # Shell into container

# Prisma
npx prisma studio            # Visual DB editor
npx prisma migrate status    # Check migrations
npx prisma db seed           # Run seed script

# GCP
gcloud config list           # Current config
gcloud projects list         # List projects
gcloud services list         # Enabled APIs
gcloud sql instances list    # Databases

# GitHub Actions
# Watch: https://github.com/OWNER/REPO/actions
# Logs: Click workflow → build job → expand each step
```

---

## 🏁 Ready to Deploy?

```
✅ All fixes applied?          → DOCKER_FIXES.md
✅ Pipeline issues reviewed?   → PIPELINE_BLOCKAGES.md
✅ Env vars configured?        → ENV_SETUP.md
✅ Secrets in GitHub?          → Settings → Secrets
✅ GCP setup done?             → GCP console
✅ Checklist completed?        → DEPLOYMENT_CHECKLIST.md

→ Ready! Push to main branch
```

