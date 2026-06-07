# Docker Build Issues & Fixes

## Issues Encountered & Solutions

### 1. **Prisma Version Incompatibility (CRITICAL)**

**Problem:**
- Database used Prisma 7.8.0, which has breaking changes
- Error: `The datasource property 'url' is no longer supported in schema files`
- Prisma 7.x requires `prisma.config.ts` for datasource configuration

**Root Cause:**
- Prisma 7.x removed the `url` field from schema datasource definition
- Database and backend had mismatched Prisma versions

**Fix Applied:**
```json
// database/package.json
{
  "dependencies": {
    "@prisma/client": "^5.21.0"
  },
  "devDependencies": {
    "prisma": "^5.21.0"
  }
}
```

**Why This Works:**
- Prisma 5.x maintains backward compatibility with `url` field in schema
- Backend already used 5.22.0, now unified across both packages

**Pipeline Risk:**
- ⚠️ Version upgrades may break in future
- **Solution:** Lock to exact version: `"prisma": "5.21.0"` (remove `^`)

---

### 2. **Prisma Client Generation Path Issue (CRITICAL)**

**Problem:**
- Prisma client generated to `/database/node_modules/@prisma/client`
- But application looked for it at `/app/node_modules/@prisma/client`
- Error: `@prisma/client did not initialize yet`

**Root Cause:**
- Prisma looks for nearest `package.json` relative to schema file
- Schema in `../database/prisma/schema.prisma` → Prisma generated to database's node_modules

**Fix Applied:**
```bash
# docker-start.sh
ln -s ../database/prisma prisma
./node_modules/.bin/prisma generate
```

**Why This Works:**
- Symlink makes schema appear local to backend directory
- Prisma finds local prisma directory → generates to `/app/node_modules/@prisma/client`

**Pipeline Risk:**
- ⚠️ Symlinks may fail on Windows CI/CD systems
- ⚠️ Some build systems don't support symlinks
- **Solution:** See Alternative Approaches below

---

### 3. **Read-Only Filesystem Error (CRITICAL)**

**Problem:**
```
EROFS: read-only file system, unlink '/database/node_modules/.prisma/client/default.d.ts'
```

**Root Cause:**
- Docker volume mounted with `:ro` (read-only) flag
- Prisma generation requires write access

**Fix Applied:**
```yaml
# docker-compose.yml
volumes:
  - ./database:/database        # Removed :ro flag
  - ./database:/app/../database # Removed :ro flag
```

**Pipeline Risk:**
- ⚠️ Dev volume mounts should NOT be in production
- ✅ Production Docker image doesn't use volume mounts

---

### 4. **Missing OpenSSL Library (HIGH)**

**Problem:**
```
Error loading shared library libssl.so.1.1: No such file or directory
Unable to require libquery_engine-linux-musl.so.node
```

**Root Cause:**
- Alpine Linux base image missing OpenSSL
- Prisma query engine binary requires OpenSSL 1.1

**Fix Applied:**
```dockerfile
# backend/Dockerfile
RUN apk add --no-cache tini openssl
```

**Pipeline Risk:**
- ✅ Fixed at base layer, applies to all stages
- **Consideration:** Alpine is minimal; other issues may arise with missing libs

---

### 5. **Prisma Not Generated in Production Build (HIGH)**

**Problem:**
- Production `build` stage didn't generate Prisma client
- Generated client never made it to `runtime` image

**Fix Applied:**
```dockerfile
# ---- build ----
FROM deps AS build
COPY ../database/ ../database/
RUN ln -s ../database/prisma prisma && ./node_modules/.bin/prisma generate
RUN npm run build && npm prune --production
```

**Why This Works:**
- Production image now includes pre-generated `.prisma/client` files
- No runtime generation needed

**Pipeline Risk:**
- ⚠️ COPY context must include parent directory
- **Solution:** Ensure Docker build context includes `/database` folder

---

## Alternative Approaches (for Robustness)

### Alternative 1: Copy Schema Instead of Symlink
```dockerfile
RUN cp -r ../database/prisma . && ./node_modules/.bin/prisma generate
```
**Pros:** No symlink issues on Windows  
**Cons:** Duplicates schema files

### Alternative 2: Run Prisma from Database Directory
```dockerfile
WORKDIR ../database
RUN npm run generate
WORKDIR /app
RUN cp -r node_modules/.prisma/client ../backend/node_modules/
```
**Pros:** Uses database's Prisma  
**Cons:** Complex path management

### Alternative 3: Monorepo Approach
Move `database` and `backend` into single monorepo with shared prisma config  
**Pros:** Single source of truth  
**Cons:** Major refactor

---

## Environment Variables Missing

**Variables Required for Production:**
```env
DATABASE_URL=postgresql://user:password@host:5432/db
JWT_ACCESS_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=google-app-password
EMAIL_FROM=your-email@gmail.com
GCP_PROJECT_ID=your-gcp-project
GCS_BUCKET_MEDIA=your-bucket-media
GCS_BUCKET_DOCS=your-bucket-docs
```

**Pipeline Risk:**
- ⚠️ Currently in `.env` file (should not be in git)
- **Solution:** Use secret management in CI/CD (GitHub Secrets, Cloud Run env vars)

---

## Database Setup Missing

**No Migration in Dockerfile:**
- Schema exists but database not initialized
- Need: `prisma migrate deploy` after connecting to real database

**For Pipeline:**
```yaml
# After deploying, run:
docker exec sportivox-api npx prisma migrate deploy
```

---

## Testing Gaps

1. **No health check script** - How to verify API is ready?
2. **No integration tests** in Docker build
3. **Database connectivity** not verified during build

**Solution:** Add health check
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/health"]
  interval: 10s
  timeout: 5s
  retries: 5
```
