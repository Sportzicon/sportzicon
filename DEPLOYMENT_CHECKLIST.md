# Deployment Checklist

## Pre-Deployment (Before pushing code)

### Code Quality
- [ ] All TypeScript types compile: `npm run typecheck`
- [ ] No linting errors: `npm run lint`
- [ ] Tests pass: `npm run test`
- [ ] No console.log or debug statements left
- [ ] Error handling is comprehensive
- [ ] No hardcoded secrets or credentials

### Docker & Build
- [ ] Docker builds locally: `docker build -f backend/Dockerfile .`
- [ ] docker-compose runs without errors: `docker-compose up`
- [ ] Health checks pass: `curl http://localhost:8080/healthz`
- [ ] No symlinks in Dockerfile (compatibility issue)
- [ ] Prisma client generates successfully
- [ ] No `.env` file in git (`git status | grep .env`)

### Database
- [ ] Schema file valid: `npx prisma validate --schema=database/prisma/schema.prisma`
- [ ] All migrations created: `ls database/prisma/migrations/`
- [ ] Migrations are idempotent (safe to re-run)
- [ ] Can run migrations locally without errors
- [ ] Database backup taken (production)

### Configuration
- [ ] `backend/.env` NOT committed to git
- [ ] `backend/.env.example` updated with new vars
- [ ] All required env vars documented in `ENV_SETUP.md`
- [ ] No hardcoded database URLs or API keys
- [ ] Correct CORS origins configured for environment

---

## Pre-CI/CD Push

### Git
- [ ] Working directory clean: `git status`
- [ ] All changes staged: `git add -A`
- [ ] Meaningful commit message written
- [ ] Commits follow convention (feat:, fix:, etc.)
- [ ] No merge conflicts
- [ ] Pushed to correct branch

### Code Review
- [ ] Code reviewed by team member
- [ ] No security vulnerabilities identified
- [ ] Database changes reviewed
- [ ] API contract changes documented

---

## CI/CD Pipeline Setup

### GitHub Secrets Configured
- [ ] `GCP_PROJECT_ID`
- [ ] `GCP_SA_KEY` (base64 encoded)
- [ ] `DATABASE_URL`
- [ ] `JWT_ACCESS_SECRET` (32+ chars)
- [ ] `JWT_REFRESH_SECRET` (32+ chars)
- [ ] `GMAIL_USER`
- [ ] `GMAIL_APP_PASSWORD`
- [ ] `EMAIL_FROM`
- [ ] `GCS_BUCKET_MEDIA`
- [ ] `GCS_BUCKET_DOCS`

**How to add secrets:**
1. Go to repo → Settings → Secrets and variables → Repository secrets
2. Click "New repository secret"
3. Add each variable

### Workflow File
- [ ] `.github/workflows/deploy.yml` exists
- [ ] Build context correct: `context: .` (not `./backend`)
- [ ] Dockerfile path correct: `file: ./backend/Dockerfile`
- [ ] Database migrations run before API starts
- [ ] Health check waits for API to be ready
- [ ] Secrets properly referenced: `${{ secrets.VAR_NAME }}`

### GCP Setup
- [ ] GCP project created
- [ ] Cloud Run enabled
- [ ] Cloud SQL instance created (if using)
- [ ] Service account created with proper roles:
  - `roles/run.admin`
  - `roles/storage.admin`
  - `roles/cloudsql.client` (if using Cloud SQL)
- [ ] Service account key downloaded and encoded

---

## Staging Deployment

### Initial Deployment
```bash
# 1. Push code with CI/CD configured
git push origin main

# 2. Watch CI/CD pipeline
# GitHub Actions → Actions tab → watch build logs

# 3. Verify deployment
gcloud run services list
gcloud run services describe sportivox-api

# 4. Test API
curl https://sportivox-api-xxxxx.run.app/healthz
```

### Post-Deployment Tests
- [ ] API responds to health check
- [ ] Database connection works
- [ ] Can authenticate: `POST /api/v1/auth/login`
- [ ] Can fetch user data: `GET /api/v1/users/me`
- [ ] GCS buckets accessible
- [ ] Email sending works (if applicable)
- [ ] Rate limiting works
- [ ] CORS headers correct
- [ ] Security headers present (Helmet)

### Logs Review
```bash
gcloud run services logs read sportivox-api
# Look for:
# - No errors
# - Successful startup messages
# - Database connectivity logs
# - GCS bucket creation logs
```

---

## Rollback Plan

### If Deployment Fails

```bash
# 1. Check Cloud Run service status
gcloud run services describe sportivox-api

# 2. View latest revision
gcloud run revisions list --service=sportivox-api

# 3. Roll back to previous revision
gcloud run services update-traffic sportivox-api \
  --to-revisions=PREV_REVISION_ID=100

# 4. Check if problem is DB-related
gcloud sql instances describe sportivox-db-prod
```

### If Database Migration Fails

```bash
# 1. Check migration status
DATABASE_URL=<prod-url> npx prisma migrate status --schema=database/prisma/schema.prisma

# 2. View failed migration logs
gcloud sql operations list --instance=sportivox-db-prod

# 3. If needed, manually resolve
DATABASE_URL=<prod-url> npx prisma migrate resolve --rolled-back "migration_name"
```

### Emergency Rollback (Last Resort)

```bash
# Delete bad revision (if necessary)
gcloud run revisions delete OLD_REVISION_ID

# Redeploy previous version
gcloud run deploy sportivox-api \
  --image=gcr.io/PROJECT_ID/sportivox-api:previous-sha
```

---

## Production Deployment

### Pre-Production Checklist
- [ ] All staging tests passed
- [ ] No known bugs in staging
- [ ] Performance acceptable (response times < 200ms)
- [ ] Database handles expected load
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Stakeholder approval obtained

### Production Safety Checks
```bash
# 1. Test production database connection
gcloud sql connect sportivox-db-prod --user=postgres

# 2. Verify all env vars set correctly
gcloud run services describe sportivox-api --format='value(spec.template.spec.containers[0].env)'

# 3. Test critical endpoints
curl https://api.sportivox.com/healthz
curl https://api.sportivox.com/api/v1/auth/login

# 4. Monitor error rates
# Open Cloud Logging dashboard
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=sportivox-api' --limit=100
```

### Post-Production Verification
- [ ] API responding
- [ ] No spike in errors
- [ ] Logs look normal
- [ ] Database connections stable
- [ ] Email sending works
- [ ] GCS operations successful
- [ ] Authentication working
- [ ] Users can use app

### Monitoring (First 24h)
- [ ] Error rate < 0.1%
- [ ] P99 latency < 500ms
- [ ] No database connection issues
- [ ] No OOM or resource issues
- [ ] Rate limiting working correctly
- [ ] Security checks passing

---

## Common Deployment Issues & Quick Fixes

### Build Context Error
```
COPY ../database/ ../database/
ERROR: COPY source '../database/' is outside of build context
```
**Fix:** Change docker-compose build context from `./backend` to `.`

### Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Fix:** Verify `DATABASE_URL` env var is set and database is running

### Prisma Generation Failed
```
Unable to require libquery_engine-linux-musl.so.node
```
**Fix:** Ensure OpenSSL installed in Docker (already in updated Dockerfile)

### Health Check Timeout
```
Liveness probe failed: HTTP probe failed
```
**Fix:** Increase startup period in Cloud Run (currently 30s)

### Out of Memory
```
JavaScript heap out of memory
```
**Fix:** Increase Cloud Run memory allocation (default 256MB → 512MB)

---

## Monitoring Setup

### Error Tracking (Optional)
```bash
# Using Sentry for error tracking
npm install @sentry/node

# Configure in server.ts
Sentry.init({ dsn: process.env.SENTRY_DSN })
```

### Performance Monitoring
- Use Cloud Trace for request tracing
- Use Cloud Profiler for performance analysis
- Enable Cloud Logging for detailed logs

### Alerting
Create alerts for:
- Error rate > 1%
- P99 latency > 1000ms
- Cloud Run instance crashes
- Database connection failures

---

## Post-Deployment

### Documentation
- [ ] Update deployment notes
- [ ] Document any manual steps taken
- [ ] Update runbook if needed
- [ ] Notify team of deployment

### Cleanup
- [ ] Delete temporary branches
- [ ] Archive old revisions (keep last 5)
- [ ] Clean up unused Cloud Run revisions

### Future Improvements
- [ ] Note any issues encountered
- [ ] Document solutions applied
- [ ] Plan improvements for next deployment
- [ ] Update this checklist if needed

---

## Quick Deployment Command

```bash
# One-command deployment (after GitHub Actions builds)
gcloud run deploy sportivox-api \
  --image=gcr.io/PROJECT_ID/sportivox-api:latest \
  --platform=managed \
  --region=us-central1 \
  --update-secrets=DATABASE_URL=DATABASE_URL:latest,\
JWT_ACCESS_SECRET=JWT_ACCESS_SECRET:latest,\
JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,\
GMAIL_USER=GMAIL_USER:latest,\
GMAIL_APP_PASSWORD=GMAIL_APP_PASSWORD:latest
```

---

## Emergency Contacts

| Role | Contact | On-Call Schedule |
|------|---------|------------------|
| DevOps Lead | @person | Yes |
| Backend Lead | @person | Yes |
| Database Admin | @person | No |

## Deployment Support
- Slack channel: #deployments
- On-call rotation: https://incident.io
- Status page: https://status.sportivox.com
