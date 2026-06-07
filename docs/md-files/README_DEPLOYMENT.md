# Sportivox API - Deployment & Pipeline Guide

## 📚 Complete Documentation Created

This guide consolidates everything needed to deploy Sportivox to production without pipeline failures.

### Documentation Files

| File | Purpose | Read When |
|------|---------|-----------|
| **FIXES_SUMMARY.md** | Overview of all fixes applied | First (5 min read) |
| **PIPELINE_BLOCKAGES.md** | 10 critical pipeline issues + solutions | Planning deployment (20 min) |
| **DOCKER_FIXES.md** | Technical details of each fix | Troubleshooting specific issues |
| **ENV_SETUP.md** | Environment variable configuration | Setting up GitHub Secrets |
| **DEPLOYMENT_CHECKLIST.md** | Pre/during/post deployment steps | Before deploying |
| **PIPELINE_FLOW.md** | Visual pipeline diagrams & flow | Understanding the process |
| **QUICK_REFERENCE.md** | Commands & quick lookups | Day-to-day use |

---

## 🎯 What Was Fixed

### Code Changes (5 files modified)

1. **database/package.json**
   - ✅ Prisma 7.8.0 → 5.21.0 (locked version)
   - Reason: Prisma 7 has breaking changes in schema format

2. **docker-compose.yml**
   - ✅ Build context: `./backend` → `.`
   - ✅ Removed `:ro` (read-only) flags from volumes
   - Reason: Allows building with parent directory access

3. **backend/Dockerfile**
   - ✅ Added `openssl` to apk install
   - ✅ Replaced symlink with copy for Prisma schema
   - ✅ Added Prisma generation to build stage
   - Reason: Production image must include Prisma client

4. **backend/docker-start.sh**
   - ✅ Replaced symlink with copy operation
   - ✅ Improved error checking
   - Reason: Windows CI/CD compatibility

5. **.github/workflows/deploy.yml** (NEW)
   - ✅ Complete CI/CD pipeline
   - ✅ Database migrations automated
   - ✅ Health checks included
   - ✅ Environment secrets integration
   - Reason: Automate deployment from git push

---

## 🚀 Quick Start (3 Steps)

### Step 1: Configure GitHub Secrets (5 minutes)
```bash
# Go to: repo → Settings → Secrets and variables → Repository secrets
# Add these 10 secrets:

GCP_PROJECT_ID           # Your GCP project
GCP_SA_KEY               # Service account key (base64)
DATABASE_URL             # postgresql://...
JWT_ACCESS_SECRET        # 32+ random chars
JWT_REFRESH_SECRET       # 32+ random chars
GMAIL_USER               # your@gmail.com
GMAIL_APP_PASSWORD       # Google app password
EMAIL_FROM               # noreply@domain.com
GCS_BUCKET_MEDIA         # your-media-bucket
GCS_BUCKET_DOCS          # your-docs-bucket
```

### Step 2: Setup GCP (10 minutes)
```bash
# Create project & enable services
gcloud projects create sportivox-prod
gcloud services enable run.googleapis.com sql.googleapis.com storage.googleapis.com

# Create service account
gcloud iam service-accounts create sportivox-ci
# Grant roles and create key (see ENV_SETUP.md for full commands)
```

### Step 3: Deploy
```bash
# Just push!
git push origin main

# Watch: repo → Actions → see build status
# Done when API responds to: curl https://api.sportivox.com/healthz
```

---

## ⚠️ Critical Issues Identified

### Will 100% Block Pipeline

| # | Issue | Status | Solution |
|---|-------|--------|----------|
| 1 | Docker build context too narrow | ✅ Fixed | Changed to `.` in docker-compose |
| 2 | Missing environment secrets | ⚠️ Manual setup | Add 10 secrets to GitHub |
| 3 | Database never migrated | ✅ Fixed | Migration job in CI/CD |
| 4 | Prisma version breaking changes | ✅ Fixed | Downgraded to 5.21.0 |

### Will Likely Block Pipeline

| # | Issue | Status | Solution |
|---|-------|--------|----------|
| 5 | Symlinks fail on Windows | ✅ Fixed | Use copy instead |
| 6 | OpenSSL missing | ✅ Fixed | Added to Dockerfile |
| 7 | Node modules caching | ✅ Improved | Use Docker layer cache |
| 8 | Port conflicts | ⚠️ Handled | Cleanup step in pipeline |

### May Cause Issues

| # | Issue | Status | Solution |
|---|-------|--------|----------|
| 9 | GCS authentication | ⚠️ Documented | Setup GCP service account |
| 10 | No health checks | ✅ Implemented | `/healthz` endpoint exists |

---

## 📋 Deployment Checklist

### Before Pushing Code
- [ ] Tests pass: `npm run test`
- [ ] Builds: `docker-compose up --build`
- [ ] Health check works: `curl http://localhost:8080/healthz`
- [ ] No secrets in code or git
- [ ] All env vars in `ENV_SETUP.md` are set

### GitHub Setup
- [ ] All 10 secrets configured
- [ ] Secrets have correct values
- [ ] Repository is public (for gcr.io access)
- [ ] GitHub Actions enabled

### GCP Setup
- [ ] Project created
- [ ] Service account with proper roles
- [ ] Cloud Run service configured
- [ ] Cloud SQL instance created (if needed)

### Go/No-Go
- [ ] Ready for first deployment?
  - [ ] Code merged to main
  - [ ] All secrets configured
  - [ ] GCP setup complete
  - [ ] Checklist items done

---

## 🔍 How to Troubleshoot

### "Build fails with COPY error"
```bash
# Check: docker-compose.yml has context: .
# Not: context: ./backend
```
See: PIPELINE_BLOCKAGES.md #1

### "API crashes with no database"
```bash
# Check: DATABASE_URL in GitHub Secrets
# Must point to real database (not localhost)
```
See: PIPELINE_BLOCKAGES.md #3

### "Missing environment variable error"
```bash
# Check: All 10 secrets in GitHub Settings
# List here: ENV_SETUP.md
```
See: ENV_SETUP.md

### "Health check timeout"
```bash
# API may need 30+ seconds to start
# Check: gcloud run services logs read sportivox-api
```
See: DEPLOYMENT_CHECKLIST.md

For more issues, see: PIPELINE_BLOCKAGES.md (10 common issues)

---

## 📊 What's Been Implemented

### Docker
- ✅ Multi-stage build (dev/build/runtime)
- ✅ Prisma client generation
- ✅ OpenSSL for binary compatibility
- ✅ Health check endpoints
- ✅ Graceful shutdown
- ✅ Proper layer caching

### CI/CD Pipeline
- ✅ GitHub Actions workflow
- ✅ Automated Docker build
- ✅ Database migrations
- ✅ Health check validation
- ✅ Cloud Run deployment
- ✅ Rollback capability

### Environment Management
- ✅ GitHub Secrets integration
- ✅ Google Secret Manager ready
- ✅ All required vars documented
- ✅ Example .env provided
- ✅ Validation scripts

### Documentation
- ✅ 7 comprehensive guides
- ✅ Visual pipeline diagrams
- ✅ Quick reference card
- ✅ Troubleshooting guide
- ✅ Deployment checklist
- ✅ Code comments

---

## 🎓 Learning Path

If you're new to this project:

1. **Read FIXES_SUMMARY.md** (5 min)
   - Understand what was fixed

2. **Read QUICK_REFERENCE.md** (10 min)
   - Learn key commands

3. **Read ENV_SETUP.md** (10 min)
   - Configure secrets

4. **Read DEPLOYMENT_CHECKLIST.md** (15 min)
   - Follow pre-deployment steps

5. **Read PIPELINE_FLOW.md** (10 min)
   - Understand the process

6. **Reference PIPELINE_BLOCKAGES.md** when needed
   - Look up specific issues

7. **Keep QUICK_REFERENCE.md handy**
   - Daily lookup

---

## ✅ Validation Commands

```bash
# Test everything locally first

# 1. Build Docker
docker build -f backend/Dockerfile -t test:latest .

# 2. Start with docker-compose
docker-compose down && docker-compose up --build

# 3. Test health
curl http://localhost:8080/healthz

# 4. Test API
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json"

# 5. Check logs
docker logs sportivox-api-1 | tail -20

# 6. If all OK, commit and push
git push origin main

# 7. Watch GitHub Actions
# https://github.com/YOUR_USER/sportivox/actions
```

---

## 🚨 Emergency Procedures

### API is down in production
```bash
# 1. Check status
gcloud run services describe sportivox-api

# 2. View logs
gcloud run services logs read sportivox-api --limit=50

# 3. Rollback if needed
gcloud run services update-traffic sportivox-api --to-revisions=PREV_ID=100

# 4. Contact: DevOps lead / on-call engineer
```

### Database is down
```bash
# 1. Check Cloud SQL status
gcloud sql instances describe sportivox-db-prod

# 2. Try restart
gcloud sql instances restart sportivox-db-prod

# 3. If still down, restore from backup
gcloud sql backups restore BACKUP_ID --backup-instance=sportivox-db-prod
```

### Data is corrupted
```bash
# 1. DO NOT REDEPLOY
# 2. Check last good backup
gcloud sql backups list --instance=sportivox-db-prod

# 3. Restore to point-in-time
gcloud sql backups restore BACKUP_ID --backup-instance=sportivox-db-prod

# 4. Contact: Database admin
```

---

## 📞 Getting Help

**For specific issues:**
- Build errors → PIPELINE_BLOCKAGES.md
- Database errors → DEPLOYMENT_CHECKLIST.md
- Env var errors → ENV_SETUP.md
- Understanding flow → PIPELINE_FLOW.md
- Quick lookup → QUICK_REFERENCE.md

**For questions:**
- GitHub Issues: Ask in repo issues
- Slack: #deployments channel
- Email: devops@sportivox.com

**Documentation is in:**
```
/sportivox/
├── FIXES_SUMMARY.md          ← Start here
├── QUICK_REFERENCE.md        ← Keep handy
├── DOCKER_FIXES.md           ← Technical details
├── PIPELINE_BLOCKAGES.md     ← Issues & solutions
├── ENV_SETUP.md              ← Secrets & config
├── DEPLOYMENT_CHECKLIST.md   ← Before deploy
├── PIPELINE_FLOW.md          ← Visual flow
└── README_DEPLOYMENT.md      ← This file
```

---

## 🎯 Success Criteria

After deployment, verify:

✅ **Immediately**
- API responds to health check
- No errors in logs
- Database connection established

✅ **Within 5 minutes**
- Users can load website
- Authentication works
- Can view data

✅ **First 24 hours**
- Error rate < 0.1%
- Response times stable
- No database issues

✅ **Ongoing**
- Daily monitoring
- Weekly backups
- Monthly security reviews

---

## 📈 Roadmap

### Completed
- ✅ Docker fixes
- ✅ Pipeline setup
- ✅ Documentation

### Next (recommended)
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Monitoring setup
- [ ] Alerting rules
- [ ] Disaster recovery plan

---

## 🎉 Summary

You now have:

1. **7 comprehensive guides** covering every aspect
2. **5 production-ready fixes** already implemented
3. **Complete CI/CD pipeline** ready to deploy
4. **10 pipeline issues identified** with solutions
5. **Emergency procedures** documented

**You're ready to deploy!** 🚀

Start with FIXES_SUMMARY.md → then follow the deployment checklist.

---

**Last Updated:** 2026-05-30  
**Status:** Production Ready  
**Next Review:** 2026-06-30
