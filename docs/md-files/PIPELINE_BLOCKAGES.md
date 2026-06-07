# CI/CD Pipeline Blockages & Solutions

## Critical Blockages That Will Fail in Pipelines

### 1. **Docker Build Context Issue** 🔴 CRITICAL

**Blockage:**
```
COPY ../database/ ../database/
# Error: COPY source '../database/' is outside of build context
```

**Why It Fails:**
- Default docker-compose build context: `./backend`
- Cannot access parent directory (`../database`)
- Works locally but fails in CI/CD with strict context enforcement

**When It Happens:**
- GitHub Actions
- GitLab CI
- Cloud Build
- Jenkins with Docker executor

**Solution:**

**Option A: Update docker-compose.yml (Dev)**
```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .                # Change to root context
      dockerfile: ./backend/Dockerfile
```

**Option B: Update GitHub Actions (CI/CD)**
```yaml
# .github/workflows/build.yml
- name: Build Docker image
  run: |
    docker build \
      --build-context app=.  \
      -f backend/Dockerfile \
      -t sportivox-api:latest .
```

**Option C: Use .dockerignore to exclude files**
```
# .dockerignore
node_modules
.git
frontend
```

---

### 2. **Environment Variables Not Available** 🔴 CRITICAL

**Blockage:**
```
docker-start.sh: line 10: $DATABASE_URL: not set
docker-start.sh: line 15: $GMAIL_USER: not set
```

**Why It Fails:**
- `.env` file contains secrets (should NOT be in git)
- CI/CD doesn't have `.env` file
- Application fails at startup without env vars

**When It Happens:**
- First deployment to staging/production
- Any CI/CD run that builds the image

**Where To Set Them:**

| Platform | Location |
|----------|----------|
| GitHub Actions | Settings → Secrets and variables → Repository secrets |
| Cloud Run | Cloud Run UI → Edit service → Environment variables |
| Docker Compose CI | Pass via `--env-file` or `-e` |
| GitHub Actions | `env:` section in workflow or use `gh secret` |

**Solution: GitHub Actions Example**
```yaml
# .github/workflows/deploy.yml
name: Deploy API
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          JWT_ACCESS_SECRET: ${{ secrets.JWT_ACCESS_SECRET }}
          GMAIL_USER: ${{ secrets.GMAIL_USER }}
          GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
        run: |
          docker build \
            --build-arg DATABASE_URL=$DATABASE_URL \
            -f backend/Dockerfile \
            -t sportivox-api:${{ github.sha }} .
```

**Action Items:**
1. ❌ Remove `.env` from git
2. ✅ Add to `.gitignore`: `backend/.env`
3. ✅ Create `.env.example` with dummy values
4. ✅ Configure all 8 required secrets in CI/CD platform

---

### 3. **Database Not Initialized** 🔴 CRITICAL

**Blockage:**
```
PrismaClientInitializationError: Can't reach database server
Error: ECONNREFUSED 127.0.0.1:5432
```

**Why It Fails:**
- Docker image built, but database doesn't exist
- Prisma migrations haven't run
- No tables/schema in target database

**When It Happens:**
- Deploying to production for first time
- Database recreated/reset
- Migration version mismatches

**Solution: Pre-deployment Setup**

For **Cloud Run** (no database in image):
```bash
# Before deploying API:
gcloud sql proxy start PROJECT:REGION:INSTANCE &
DATABASE_URL="postgresql://user:pass@localhost/db" \
npx prisma migrate deploy --schema=database/prisma/schema.prisma
```

For **Docker Compose** (with postgres service):
```yaml
# Ensure postgres health check passes before running migrations
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U sportivox"]
  interval: 5s
  timeout: 3s
  retries: 10

# Add init container
migrate:
  image: node:20-alpine
  working_dir: /app
  volumes:
    - ./database:/app/database
  environment:
    DATABASE_URL: postgresql://sportivox:localdev@postgres:5432/sportivox
  depends_on:
    postgres:
      condition: service_healthy
  command: |
    sh -c 'npm install && npx prisma migrate deploy'
```

**Action Items:**
1. ✅ Add migration job to CI/CD pipeline
2. ✅ Ensure postgres is healthy before migration
3. ✅ Verify `DATABASE_URL` is set correctly
4. ✅ Handle idempotent migrations (safe to re-run)

---

### 4. **Symlink Issues on Windows CI/CD** 🟡 HIGH

**Blockage:**
```
ln: failed to create symbolic link 'prisma': Operation not permitted
# On Windows runners or strict Linux containers
```

**Why It Fails:**
- Windows doesn't support symlinks without admin
- Some CI/CD runners have symlink disabled
- GitHub Actions on Windows runner can't create symlinks in Docker

**When It Happens:**
- Windows runner in GitHub Actions
- Jenkins on Windows machine
- Docker Desktop on Windows (sometimes)

**Solution: Replace Symlink**

Update `docker-start.sh`:
```bash
#!/bin/sh
set -e

# Instead of symlink, copy the schema
if [ ! -d "prisma" ]; then
  echo "Setting up Prisma schema..."
  mkdir -p prisma
  cp -r ../database/prisma/* prisma/
fi

echo "Generating Prisma client..."
./node_modules/.bin/prisma generate

# Verify generation
if [ ! -f "node_modules/.prisma/client/default.js" ]; then
  echo "ERROR: Prisma client generation failed!"
  exit 1
fi

echo "Starting development server..."
exec npx tsx watch src/server.ts
```

Update `Dockerfile`:
```dockerfile
# ---- build ----
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
# Copy database schema for Prisma generation
COPY ../database/ ../database/
# Copy instead of symlink (works on all platforms)
RUN cp -r ../database/prisma . && ./node_modules/.bin/prisma generate
RUN npm run build && npm prune --production
```

**Action Items:**
1. ✅ Replace symlinks with copy operations
2. ✅ Test on Windows runner if supporting it

---

### 5. **Node Modules Cache Issues** 🟡 HIGH

**Blockage:**
```
npm WARN deprecated [package]: Old version detected
npm ERR! peer dep missing
Dockerfile build takes 5+ minutes
```

**Why It Fails:**
- Docker layer caching invalidated unnecessarily
- Full `npm install` on every build
- Lock file version mismatches

**Solution: Docker Build Optimization**

```dockerfile
# ---- deps (full, for build & dev) ----
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund  # Use 'ci' not 'install'
```

In CI/CD, enable Docker layer caching:

**GitHub Actions:**
```yaml
- uses: docker/build-push-action@v4
  with:
    context: .
    cache-from: type=registry,ref=ghcr.io/user/sportivox-api:buildcache
    cache-to: type=registry,ref=ghcr.io/user/sportivox-api:buildcache
```

**Action Items:**
1. ✅ Use `npm ci` instead of `npm install` in Dockerfile
2. ✅ Keep `package-lock.json` in git
3. ✅ Enable Docker layer caching in CI/CD
4. ✅ Use Docker buildx for better caching

---

### 6. **Port Already in Use** 🟡 HIGH

**Blockage:**
```
Error: listen EADDRINUSE :::8080
Port 8080 already in use
```

**Why It Fails:**
- Previous container still running
- Another service using same port
- CI/CD machine has residual containers

**Solution:**

**In docker-compose:**
```yaml
# Ensure cleanup before starting
api:
  image: sportivox-api:latest
  ports:
    - "8080:8080"
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
    interval: 10s
```

**In CI/CD pipeline:**
```yaml
- name: Cleanup previous containers
  run: docker-compose down || true

- name: Start services
  run: docker-compose up -d

- name: Wait for API to be ready
  run: |
    for i in {1..30}; do
      curl -f http://localhost:8080/api/v1/health && exit 0
      sleep 1
    done
    exit 1
```

---

### 7. **GCS Bucket Creation Failures** 🟡 HIGH

**Blockage:**
```
Error: Failed to create bucket sportivox-media-dev
Error: GCS authentication failed
```

**Why It Fails:**
- GCP credentials not available in CI/CD
- Service account missing permissions
- GCS_BUCKET_* env vars not set

**Solution:**

**For Cloud Run (Production):**
```yaml
# Grant Cloud Run service account permission
roles/storage.admin
```

**For Local Testing:**
```bash
# Use fake-gcs-server (already in docker-compose)
export STORAGE_EMULATOR_HOST=http://gcs:4443
```

**Action Items:**
1. ✅ Set up GCP service account for CI/CD
2. ✅ Configure IAM roles for storage access
3. ✅ Use emulator for local/integration tests

---

### 8. **Prisma Engine Binary Mismatch** 🟡 MEDIUM

**Blockage:**
```
The Prisma engines do not seem to be compatible with your system
Expected file: libquery_engine-linux-musl.so.node
Got: libquery_engine-linux-gnu.so.node
```

**Why It Fails:**
- Different libc versions (musl vs glibc)
- Binary built on different architecture
- Generated on macOS/Windows, running on Linux

**Solution:**

Regenerate Prisma in target environment:
```dockerfile
# Always regenerate in final image
RUN ln -s ../database/prisma prisma
RUN ./node_modules/.bin/prisma generate
```

Or specify architecture:
```yaml
# docker-compose
services:
  api:
    platform: linux/amd64  # Force consistent architecture
```

---

### 9. **Missing Database Migrations** 🟡 MEDIUM

**Blockage:**
```
PrismaClientValidationError: Unknown field 'newColumn' on model 'User'
```

**Why It Fails:**
- Schema updated but migrations not run
- Database schema out of sync with Prisma schema

**Solution: Add Migration Job**

```yaml
# .github/workflows/deploy.yml
- name: Run database migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: |
    cd database
    npx prisma migrate deploy
```

**Action Items:**
1. ✅ Make migrations part of deployment pipeline
2. ✅ Run migrations before API starts
3. ✅ Test migrations in staging first

---

### 10. **No Health Check / Liveness Probe** 🟡 MEDIUM

**Blockage:**
```
API appears running but requests fail
No way to know if service is healthy
Container restarts continuously
```

**Solution: Add Health Endpoint**

```typescript
// backend/src/routes/health.ts
export async function setupHealthRoutes(app: Express) {
  app.get('/api/v1/health', (req, res) => {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.APP_VERSION
    });
  });
}
```

**Add to docker-compose:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 30s
```

**Add to Cloud Run:**
```yaml
# cloudbuild.yaml
service:
  health_check:
    type: liveness
    initial_delay_seconds: 30
    period_seconds: 10
    path: /api/v1/health
```

---

## Pre-Deployment Checklist

```markdown
- [ ] All 8 environment secrets configured in CI/CD
- [ ] Docker build context includes /database folder
- [ ] Symlinks replaced with copy operations
- [ ] Database migrations automated in pipeline
- [ ] Health check endpoint implemented
- [ ] OpenSSL included in Docker image
- [ ] Prisma version locked (not using ^)
- [ ] .env file in .gitignore
- [ ] package-lock.json committed to git
- [ ] Docker layer caching enabled
- [ ] Port 8080 available in deployment environment
- [ ] GCP credentials configured
- [ ] Database initialized before API starts
- [ ] Fallback/rollback strategy defined
```

---

## Testing Pipeline Locally

```bash
# Simulate CI/CD locally
docker build -f backend/Dockerfile -t sportivox-api:test .

# Run with env vars (no .env file)
docker run -e DATABASE_URL=postgresql://... \
  -e JWT_ACCESS_SECRET=test-secret-32-chars-min \
  -e GMAIL_USER=test@gmail.com \
  -p 8080:8080 sportivox-api:test

# Test health endpoint
curl http://localhost:8080/api/v1/health
```

---

## Estimated Pipeline Failures (If Not Fixed)

| Issue | Likelihood | Impact | Impact on Deploy Time |
|-------|-----------|--------|----------------------|
| Build context error | 100% | Blocks all builds | Deploy fails |
| Missing env vars | 100% | Runtime failure | Deploy succeeds, API fails |
| Database not initialized | 80% | API crashes | Deploy succeeds, service down |
| Symlink on Windows | 50% | Build fails | Deploy fails on Windows runners |
| Port conflict | 40% | Integration tests fail | Tests fail, deploy blocked |
| No health check | 30% | Silent failures | Deploy succeeds, issues hidden |

