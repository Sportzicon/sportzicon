# CI/CD Pipeline Flow & Failure Points

## Complete Deployment Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Developer Pushes Code                        │
│                              git push main                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │   GitHub Actions Workflow Triggered      │
        │   .github/workflows/deploy.yml           │
        └──────────────────┬───────────────────────┘
                           │
        ┌──────────────────┴───────────────────────┐
        ▼                                           ▼
   ┌─────────────┐                        ┌──────────────────┐
   │ Test Stage  │                        │  Build Stage     │
   └──────┬──────┘                        └────────┬─────────┘
          │                                        │
    ┌─────▼──────────────┐                  ┌─────▼────────────────────┐
    │ 1. Checkout Code   │                  │ 4. Build Docker Image    │
    │ ❌ Risk: None       │                  │ ❌ Risk: Build context   │
    └─────┬──────────────┘                  └─────┬────────────────────┘
          │                                        │
    ┌─────▼──────────────┐                  ┌─────▼────────────────────┐
    │ 2. Setup Database  │                  │ 5. Validate Prisma       │
    │ ❌ Risk: No DB      │                  │ ❌ Risk: Env vars needed │
    └─────┬──────────────┘                  └─────┬────────────────────┘
          │                                        │
    ┌─────▼──────────────┐                  ┌─────▼────────────────────┐
    │ 3. Run Tests       │                  │ 6. Push to Registry      │
    │ ❌ Risk: DB init    │                  │ ❌ Risk: GCP auth        │
    └─────┬──────────────┘                  └─────┬────────────────────┘
          │                                        │
          └─────────────────────┬──────────────────┘
                                │
                    ┌───────────▼──────────────┐
                    │   Integration Check      │
                    │  All tests passed?       │
                    └───────────┬──────────────┘
                                │
                    ┌───────────┴──────────────┐
                    │                          │
                 Yes│                          │No
                    │                          │
                    ▼                          ▼
            ┌──────────────┐          ┌──────────────┐
            │  Approved ✅ │          │  Failed ❌   │
            │  Deploy      │          │  Notify Dev  │
            └──────┬───────┘          │  Rollback    │
                   │                  └──────────────┘
                   │
        ┌──────────▼────────────┐
        │  Deploy to Cloud Run  │
        │  - Update image       │
        │  - Set env variables  │
        │  - Run migrations     │
        └──────────┬────────────┘
                   │
        ┌──────────▼────────────┐
        │   Health Checks       │
        │  Wait for API ready   │
        │  (max 30 seconds)     │
        └──────────┬────────────┘
                   │
         ┌─────────┴──────────┐
         │                    │
      Ready│              Not Ready│
         │                    │
         ▼                    ▼
    ┌────────┐          ┌──────────┐
    │ ✅ Live│          │ ❌ Rollback
    │        │          │  to prev  │
    └────────┘          │  version  │
                        └──────────┘
```

---

## Critical Failure Points

### 🔴 CRITICAL: Build Context Issue
```
Step: Build Docker Image
Error: COPY ../database/ is outside of build context

┌─────────────────────────────┐
│ .github/workflows/deploy.yml│
└────────┬────────────────────┘
         │
    ┌────▼─────────────┐
    │ Docker build ... │
    │ --context ./backend  ❌
    │ FAILS!           │
    └──────────────────┘

FIX: Change to --context .
```

### 🔴 CRITICAL: Missing Environment Variables
```
Step: Run database migrations / Deploy to Cloud Run
Error: DATABASE_URL is undefined

┌──────────────────────────────┐
│ GitHub Actions runs command  │
│ But DATABASE_URL secret      │
│ never added to Settings      │
└────────┬─────────────────────┘
         │
    ┌────▼──────────────┐
    │ API starts but    │
    │ Can't connect DB  │
    │ ❌ CRASHES         │
    └───────────────────┘

FIX: Add all 10 secrets to GitHub repo
```

### 🔴 CRITICAL: Database Not Initialized
```
Step: API deployed but no schema
Error: PrismaClientInitializationError

   API Deployed
        │
        ▼
   ┌────────────────┐
   │ API tries to   │
   │ access database│
   │ No tables!     │
   │ ❌ CRASHES      │
   └────────────────┘

FIX: Run migrations BEFORE starting API
gcloud sql migrate deploy
```

### 🟡 HIGH: Symlink on Windows
```
Step: Generate Prisma in Docker
Error: ln: operation not permitted

If Windows runner:
    ├─ GitHub Actions on Windows
    ├─ Jenkins on Windows
    └─ WSL with strict mode
         │
         ▼
    ❌ Symlink fails
    ❌ Build fails
    ❌ Deploy blocked

FIX: Use copy instead of symlink
RUN cp -r ../database/prisma .
```

---

## Data Flow Through Pipeline

```
Developer Code
     │
     ├─► .github/workflows/deploy.yml
     │        │
     │        ├─► Tests (optional)
     │        │
     │        └─► Docker build
     │             │
     │             ├─► COPY src/
     │             ├─► COPY database/prisma ⚠️ NEEDS CORRECT CONTEXT
     │             ├─► Generate Prisma   ⚠️ NEEDS npm install
     │             ├─► npm run build
     │             │
     │             └─► Docker image pushed to gcr.io/
     │
     └─► Cloud Run deployment
          │
          ├─► Set environment variables ⚠️ FROM GITHUB SECRETS
          │
          ├─► Start container
          │
          ├─► Run DB migrations ⚠️ NEEDS DATABASE_URL
          │
          ├─► Wait for health check (max 30s)
          │
          └─► Route traffic to new revision
```

---

## Environment Variables Journey

```
┌──────────────────────┐
│ Manual Setup (Dev)   │
│ backend/.env         │
│ ❌ NEVER in git!     │
└──────┬───────────────┘
       │
┌──────┴───────────────────────────┐
│                                  │
▼                                  ▼
┌─────────────────┐    ┌──────────────────────┐
│ Local Testing   │    │ GitHub Secrets Setup │
│ docker-compose  │    │ Settings→Secrets     │
│ .env file       │    │ 10 required vars     │
└─────────────────┘    └──────┬───────────────┘
                               │
                        ┌──────▼───────────┐
                        │ GitHub Actions   │
                        │ ${{ secrets.X }} │
                        └──────┬───────────┘
                               │
                        ┌──────▼──────────────┐
                        │ Docker build -e VAR │
                        │ During CI/CD build  │
                        └──────┬───────────────┘
                               │
                        ┌──────▼───────────────┐
                        │ Cloud Run            │
                        │ --set-env-vars VAR= │
                        │ At deployment time  │
                        └─────────────────────┘
```

---

## Success Scenario

```
git push main
    │
    ▼ (Webhook)
GitHub Actions
    │
    ├─ Checkout code ✅
    ├─ Build Docker (context: .) ✅
    │   ├─ Copy database/prisma ✅
    │   ├─ Generate Prisma ✅
    │   └─ npm run build ✅
    │
    ├─ Push image to gcr.io ✅
    │
    └─ Deploy to Cloud Run ✅
        ├─ Create revision ✅
        ├─ Set env vars (from secrets) ✅
        ├─ Start container ✅
        ├─ Wait for health check ✅
        │  GET /healthz → 200 OK ✅
        └─ Switch traffic ✅

📊 Result: API.sportivox.com is live! 🎉
```

---

## Failure Scenario Example

```
git push main
    │
    ▼
GitHub Actions
    │
    ├─ Checkout code ✅
    │
    └─ Build Docker (context: ./backend) ❌
        │
        └─ COPY ../database/
           ERROR: source is outside build context
           
           BUILD FAILED ❌
           
        Notification:
        @user Build failed: deploy workflow
        See logs at: GitHub Actions
        
        Developer sees:
        ❌ Red X on commit
        
        ACTION NEEDED:
        1. Fix docker-compose.yml context
        2. git push again
        3. Wait for re-run
```

---

## Environment Variable Check

```
Each deployment verifies:

┌─ DATABASE_URL
│  └─ Can connect? ❌→ FAIL
│  └─ Credentials valid? ❌→ FAIL
├─ JWT_ACCESS_SECRET (32+ chars)
│  └─ Length >= 32? ❌→ FAIL
├─ JWT_REFRESH_SECRET (32+ chars)
│  └─ Length >= 32? ❌→ FAIL
├─ GMAIL_USER
│  └─ Valid email? ❌→ FAIL
├─ GMAIL_APP_PASSWORD
│  └─ Valid app password? ❌→ FAIL
├─ GCP_PROJECT_ID
│  └─ Project exists? ❌→ FAIL
├─ GCS_BUCKET_MEDIA
│  └─ Bucket accessible? ❌→ FAIL
└─ GCS_BUCKET_DOCS
   └─ Bucket accessible? ❌→ FAIL

Missing even ONE → Deployment fails
```

---

## Rollback Flow

```
If deployment fails or errors detected:

                Live (old version)
                       │
                       ▼
            ┌────────────────────┐
            │ New revision fails  │
            │ health check       │
            └─────────┬──────────┘
                      │
            ┌─────────▼──────────┐
            │ Cloud Run detects  │
            │ start failure      │
            │ ❌ 3 retries failed │
            └─────────┬──────────┘
                      │
            ┌─────────▼──────────┐
            │ Automatic rollback │
            │ to previous        │
            │ revision 100%      │
            └─────────┬──────────┘
                      │
            ┌─────────▼──────────┐
            │ Old API still live │
            │ Service restored   │
            │ No downtime! ✅    │
            └────────────────────┘
```

---

## Pre-Production Checklist (Visual)

```
┌─────────────────────────────────────────────┐
│         Deployment Readiness Check          │
├─────────────────────────────────────────────┤
│                                             │
│  ☐ Code compiled (npm run build)            │
│  ☐ Tests pass (npm run test)                │
│  ☐ Docker builds (docker build)             │
│  ☐ docker-compose up works                  │
│  ☐ Health check responds                    │
│                                             │
│  ☐ All 10 env vars documented               │
│  ☐ GitHub Secrets configured (all 10)       │
│  ☐ GCP service account created              │
│  ☐ Database provisioned + accessible        │
│  ☐ Cloud Run service created                │
│                                             │
│  ☐ Build context verified (.)               │
│  ☐ Symlinks replaced with copy              │
│  ☐ Prisma version locked                    │
│  ☐ OpenSSL in Dockerfile                    │
│                                             │
│  ☐ Staging deployment tested                │
│  ☐ Staging health checks pass               │
│  ☐ Staging API responds to requests         │
│                                             │
│                                             │
│  🟢 READY FOR PRODUCTION DEPLOYMENT         │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Quick Decision Tree

```
Want to deploy?
│
├─ Not ready → Run through DEPLOYMENT_CHECKLIST.md
│
├─ Ready locally → Test docker-compose first
│  │
│  ├─ Docker fails → Check PIPELINE_BLOCKAGES.md #1-3
│  │
│  └─ Docker works → Commit & push
│     │
│     └─ GitHub Actions starts automatically
│        │
│        ├─ Build fails → Check GitHub Actions logs
│        │  └─ COPY error? → Fix docker-compose.yml context
│        │  └─ Env var? → Add to GitHub Secrets
│        │  └─ Prisma? → Check database/package.json version
│        │
│        └─ Build succeeds → Check deployment logs
│           │
│           ├─ API starts ✅
│           │  └─ Check https://api.sportivox.com/healthz
│           │
│           └─ API fails ❌
│              └─ Check cloud logs: gcloud run services logs read sportivox-api
```

