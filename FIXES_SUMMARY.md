# Docker & Pipeline Fixes Summary

## What Was Fixed

### 1. Prisma Version Incompatibility ✅
**Issue:** Prisma 7.8.0 breaking changes  
**Fixed:** Downgraded to 5.21.0 (locked version in database/package.json)

### 2. Prisma Client Generation Path ✅
**Issue:** Generated to `/database/node_modules` instead of `/app/node_modules`  
**Fixed:** Use copy instead of symlink (works on all platforms)

### 3. Read-Only Filesystem ✅
**Issue:** Volume mounted with `:ro` flag blocking writes  
**Fixed:** Removed read-only flags from docker-compose.yml

### 4. Missing OpenSSL Library ✅
**Issue:** Alpine Linux missing OpenSSL for Prisma  
**Fixed:** Added `openssl` to Dockerfile apk install

### 5. Production Build Not Generating Prisma ✅
**Issue:** Production Dockerfile didn't generate Prisma client  
**Fixed:** Added Prisma generation to `build` stage

### 6. Docker Build Context ✅
**Issue:** Build context too narrow, couldn't access `/database`  
**Fixed:** Changed context from `./backend` to `.` in docker-compose.yml

### 7. Symlink Compatibility ✅
**Issue:** Symlinks fail on Windows CI/CD  
**Fixed:** Replaced symlinks with copy operations in docker-start.sh and Dockerfile

---

## Files Modified

| File | Changes |
|------|---------|
| `database/package.json` | Locked Prisma to 5.21.0 |
| `docker-compose.yml` | Build context `.` + removed `:ro` flags |
| `backend/Dockerfile` | Added OpenSSL, copy instead of symlink |
| `backend/docker-start.sh` | Copy schema instead of symlink |
| `.github/workflows/deploy.yml` | NEW: CI/CD pipeline |

---

## Files Created (Documentation)

| File | Purpose |
|------|---------|
| `DOCKER_FIXES.md` | Detailed explanation of each fix |
| `PIPELINE_BLOCKAGES.md` | 10 critical pipeline issues + solutions |
| `ENV_SETUP.md` | Environment variable guide |
| `DEPLOYMENT_CHECKLIST.md` | Pre/during/post deployment checklist |
| `FIXES_SUMMARY.md` | This file |

---

## Pipeline Issues Identified & Solutions

### Critical Issues (Will Break Pipeline)

| # | Issue | Root Cause | Solution |
|---|-------|-----------|----------|
| 1 | Build context error | COPY reaches outside context | Change context to `.` |
| 2 | Missing env vars | Secrets in .env not in git | Use GitHub Secrets |
| 3 | Database not initialized | No migrations run | Add migration job to CI/CD |
| 4 | Symlink fails on Windows | Symlinks not supported | Use copy instead |

### High-Risk Issues (May Break Pipeline)

| # | Issue | Root Cause | Solution |
|---|-------|-----------|----------|
| 5 | Node modules cache miss | Docker layer invalidation | Use `npm ci` + cache |
| 6 | Port already in use | Previous container running | Add cleanup step |
| 7 | GCS auth fails | No credentials in CI/CD | Configure service account |
| 8 | Prisma engine mismatch | Built on wrong platform | Regenerate in target env |

### Medium-Risk Issues (May Cause Issues)

| # | Issue | Root Cause | Solution |
|---|-------|-----------|----------|
| 9 | Database migrations fail | Schema out of sync | Automate migrations |
| 10 | No health check visibility | Can't verify API ready | Use existing /healthz |

---

## What's Ready for Pipeline

✅ **Docker Image**
- Multi-stage build optimized
- Prisma client generated during build
- OpenSSL included
- Health checks available

✅ **GitHub Actions Workflow**
- Build with correct context
- Database migration job
- Health check validation
- Cloud Run deployment

✅ **Environment Setup**
- Documented all required variables
- GitHub Secrets setup instructions
- Example configurations provided
- GCP service account setup guide

✅ **Monitoring**
- Health check endpoints exist (`/healthz`, `/readyz`)
- Logging configured with Pino
- Error handling comprehensive

---

## Quick Start: Getting to Production

### Step 1: Setup GitHub (5 minutes)
```bash
# 1. Go to repo Settings → Secrets and variables → Repository secrets
# 2. Add these 10 secrets (use values from production infrastructure):
GCP_PROJECT_ID
GCP_SA_KEY
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
GMAIL_USER
GMAIL_APP_PASSWORD
EMAIL_FROM
GCS_BUCKET_MEDIA
GCS_BUCKET_DOCS
```

### Step 2: Setup GCP (10 minutes)
```bash
# 1. Create Cloud Run service
gcloud run create sportivox-api --platform managed

# 2. Create Cloud SQL instance (if needed)
gcloud sql instances create sportivox-db-prod

# 3. Create service account for CI/CD
gcloud iam service-accounts create sportivox-ci
```

### Step 3: Deploy (automated)
```bash
# 1. Just push to main
git push origin main

# 2. GitHub Actions runs automatically
# 3. API deployed to Cloud Run
# 4. Done! ✅
```

---

## Testing Locally (Before Push)

```bash
# 1. Build Docker image (tests build context)
docker build -f backend/Dockerfile -t sportivox-api:test .

# 2. Run with env vars (no .env file)
docker run \
  -e DATABASE_URL="postgresql://user:pass@localhost/db" \
  -e JWT_ACCESS_SECRET="test-secret-32-characters-minimum" \
  -e GMAIL_USER="test@gmail.com" \
  -p 8080:8080 \
  sportivox-api:test

# 3. Test health check
curl http://localhost:8080/healthz
# Should return: {"ok":true,"service":"sportivox-api","env":"development"}

# 4. Run full stack with docker-compose
docker-compose down && docker-compose up --build

# 5. Verify all services
curl http://localhost:8080/healthz      # API
curl http://localhost:5173              # Web
# Check postgres is running: docker ps
```

---

## Known Limitations & Workarounds

| Issue | Limitation | Workaround |
|-------|-----------|-----------|
| No Windows dev support | Symlinks not reliable | Use WSL2 or GitHub Codespaces |
| GCS bucket format | Fake GCS != real GCS | Use emulator for tests, real GCS for prod |
| Long build times | 5+ minutes per build | Enable Docker layer caching (GitHub Actions does this) |
| Schema in separate dir | Database isolated from API | Consider monorepo layout for v2 |

---

## Rollback Procedures

### If deployment fails:
```bash
# 1. Check what went wrong
gcloud run services describe sportivox-api

# 2. Rollback to previous revision
gcloud run services update-traffic sportivox-api --to-revisions=PREV_SHA=100

# 3. If database issue, check migrations
DATABASE_URL=... npx prisma migrate status --schema=database/prisma/schema.prisma
```

---

## Monitoring & Alerts (Recommended)

Set up these alerts in Google Cloud Console:
- Error rate > 1%
- P99 latency > 1000ms
- Memory usage > 90%
- Database connection failures
- Cloud Run revision crashes

---

## Next Steps

1. **Immediate (today):**
   - Configure GitHub Secrets
   - Test local Docker build
   - Review PIPELINE_BLOCKAGES.md

2. **This week:**
   - Setup GCP project
   - Create Cloud Run service
   - Create Cloud SQL database
   - Test CI/CD pipeline with dry run

3. **Before production:**
   - Load test API
   - Test database backups
   - Test rollback procedure
   - Simulate failure scenarios
   - Get security review

4. **On-going:**
   - Monitor error rates
   - Review logs daily
   - Plan infrastructure scaling
   - Update documentation as needed

---

## Support & Troubleshooting

### Build Fails with "COPY ../database"
**Solution:** Verify docker-compose.yml has `context: .` (not `./backend`)

### "Missing required environment variable"
**Solution:** Check GitHub Secrets are configured (Settings → Secrets)

### "Cannot connect to database"
**Solution:** Verify DATABASE_URL env var is correct and database is running

### "Health check fails"
**Solution:** Wait 30+ seconds for API to start (Cloud Run has startup delay)

### "Out of memory"
**Solution:** Increase Cloud Run memory: `--memory 512Mi` (default is 256Mi)

---

## Summary Table

| Aspect | Status | Risk | Notes |
|--------|--------|------|-------|
| Docker Build | ✅ Fixed | Low | Tested locally, works |
| Prisma Generation | ✅ Fixed | Low | Windows compatible |
| CI/CD Pipeline | ✅ Ready | Low | Needs secrets configured |
| Environment Setup | ✅ Documented | Low | All vars listed |
| Database Migrations | ✅ Included | Medium | Needs real DB |
| Monitoring | ✅ Available | Low | Health checks implemented |
| Rollback Plan | ✅ Documented | Low | Procedures available |
| Production Ready | ⚠️ Almost | High | Needs GCP setup + secrets |

---

**Last Updated:** 2026-05-30  
**Maintainer:** @gitusrmahesh  
**Status:** Ready for testing in staging
