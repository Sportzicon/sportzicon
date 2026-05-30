# Production Readiness Checklist

A prioritized list of gaps to address before/after going live with real users.
Work through these in order — Critical first, then High, then Medium, then Enterprise.

---

## 🔴 Critical — Fix Before Real Users

### 1. Email Delivery (SendGrid)
**Problem:** `SENDGRID_API_KEY` not set → email verification broken, password reset impossible.

**Fix:**
1. Sign up at https://sendgrid.com, create an API key with "Mail Send" permission
2. Add to GCP Secret Manager:
   ```bash
   echo -n "SG.your-key-here" | gcloud secrets versions add sportivox-sendgrid-api-key-prod \
     --data-file=- --project=sportivox-app
   ```
3. In `infra/terraform/terraform.tfvars.staging`, set:
   ```hcl
   optional_secrets = ["SENDGRID_API_KEY"]
   sendgrid_api_key = ""   # leave blank — value is already in Secret Manager
   ```
4. Verify `EMAIL_FROM` domain is authenticated in SendGrid (SPF + DKIM records)

**Files:** `backend/src/config/mailer.ts`, `infra/terraform/secrets.tf`

---

### 2. Password Reset Flow
**Problem:** No `/auth/forgot-password` or `/auth/reset-password` endpoints exist.

**Fix — Backend:**
- Add `forgot-password` endpoint:
  - Accept email, generate a short-lived token (15 min), store in Firestore `password_reset_tokens` collection
  - Send reset link via SendGrid: `{WEB_APP_URL}/reset-password?token=xxx`
- Add `reset-password` endpoint:
  - Validate token (not expired, not used), hash new password, update user, delete token

**Fix — Frontend:**
- Add `ForgotPassword.tsx` page with email input
- Add `ResetPassword.tsx` page with new password form
- Add routes in `App.tsx`

**Files to create:**
- `backend/src/modules/auth/auth.routes.ts` (add 2 routes)
- `frontend/src/pages/ForgotPassword.tsx`
- `frontend/src/pages/ResetPassword.tsx`

---

### 3. Refresh Token Revocation
**Problem:** Refresh tokens are stateless JWTs valid for 30 days — stolen tokens cannot be invalidated.

**Fix:**
- Store issued refresh tokens in Firestore `refresh_tokens` collection (token hash → user_id, expires_at)
- On `/auth/refresh`: validate token exists in DB before issuing new access token
- On `/auth/logout`: delete token from DB
- Add a background cleanup for expired tokens (Cloud Scheduler job)

**Files:** `backend/src/modules/auth/tokens.ts`, `backend/src/modules/auth/auth.service.ts`

---

### 4. Content Security Policy
**Problem:** `contentSecurityPolicy: false` in Helmet — XSS vulnerability.

**Fix — `backend/src/app.ts`:**
```ts
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://storage.googleapis.com"],
      connectSrc: ["'self'", env.PUBLIC_API_URL ?? ""],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
})
```

---

### 5. Frontend on CDN (not Cloud Run)
**Problem:** Frontend static files served from Cloud Run — cold starts, slow TTFB, unnecessary compute cost.

**Fix option A — Firebase Hosting (simplest):**
```bash
npm install -g firebase-tools
firebase init hosting   # point to frontend/dist
firebase deploy --only hosting
```
Add to GitHub Actions: build frontend → `firebase deploy --only hosting`

**Fix option B — Cloud CDN + Cloud Storage:**
- Build frontend → upload to GCS bucket → enable Cloud CDN

**Impact:** ~10x faster page loads, zero cold start on frontend, free tier covers most traffic.

---

## 🟠 High — Operations & Reliability

### 6. Error Tracking (Sentry)
**Problem:** Runtime errors after deployment are invisible — no alerts, no stack traces.

**Fix:**
1. Create project at https://sentry.io (free tier available)
2. Backend: `npm install @sentry/node` in `backend/`
   ```ts
   // backend/src/server.ts — before createApp()
   import * as Sentry from "@sentry/node";
   Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
   ```
3. Frontend: `npm install @sentry/react` in `frontend/`
   ```ts
   // frontend/src/main.tsx
   Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
   ```
4. Add `SENTRY_DSN` to Secret Manager and `VITE_SENTRY_DSN` to build args in `deploy-staging.yml`

**Files:** `backend/src/server.ts`, `frontend/src/main.tsx`, `backend/src/config/env.ts`

---

### 7. GCP Alerting Policies
**Problem:** No alerts when API goes down, error rate spikes, or Cloud Run restarts.

**Fix — add `infra/terraform/monitoring.tf`:**
```hcl
resource "google_monitoring_alert_policy" "api_error_rate" {
  display_name = "API 5xx Error Rate"
  combiner     = "OR"
  conditions {
    display_name = "5xx rate > 5%"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      duration        = "60s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.name]
}

resource "google_monitoring_notification_channel" "email" {
  display_name = "Ops Email"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}
```
Add `alert_email` variable to `variables.tf` and `terraform.tfvars.staging`.

---

### 8. Firestore Automated Backups
**Problem:** No backup — data loss on accidental delete or corruption is unrecoverable.

**Fix — add `infra/terraform/backup.tf`:**
```hcl
resource "google_cloud_scheduler_job" "firestore_backup" {
  name      = "firestore-daily-backup-${var.env}"
  schedule  = "0 3 * * *"   # 3 AM daily
  time_zone = "Asia/Kolkata"

  http_target {
    http_method = "POST"
    uri         = "https://firestore.googleapis.com/v1/projects/${var.project_id}/databases/(default):exportDocuments"
    body        = base64encode(jsonencode({ outputUriPrefix = "gs://${var.gcs_bucket_terraform_state}/firestore-backups" }))
    oauth_token {
      service_account_email = data.google_service_account.runtime.email
    }
  }
}
```
Grant runtime SA `roles/datastore.importExportAdmin` in `main.tf`.

---

### 9. Account Lockout After Failed Logins
**Problem:** Rate limiting is IP-based — attackers can rotate IPs to brute-force passwords.

**Fix — `backend/src/modules/auth/auth.service.ts`:**
- Track failed login attempts in Firestore: `login_attempts/{email}` → `{ count, last_attempt, locked_until }`
- Lock account for 15 minutes after 10 consecutive failures
- Reset counter on successful login
- Return `423 Locked` with `locked_until` timestamp

---

### 10. Staging / Production Separation
**Problem:** `terraform.tfvars.staging` has `env = "prod"` — staging and production share SA names, secret names, bucket names.

**Fix:**
1. Change `env = "staging"` in `terraform.tfvars.staging`
2. Create `sportivox-run-staging` SA (bootstrap script already handles this if env is passed)
3. Create separate GCS buckets, secrets, Cloud Run services for staging
4. Update GitHub Actions `deploy-staging.yml` backend config prefix to `staging`
5. Create `deploy-production.yml` workflow triggered by git tags (`v*`)

---

### 11. GCP Budget Alerts
**Problem:** No billing limits — unexpected usage causes surprise charges.

**Cannot be done via Terraform** — billing permissions are account-level, not project-level. One-time manual setup.

**Steps — GCP Console:**

1. Go to `https://console.cloud.google.com/billing`
2. Select your billing account → **Budgets & alerts** → **Create budget**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | Name | `Sportivox Monthly Budget` |
   | Projects | `sportivox-app` |
   | Services | All services |
   | Budget type | Monthly |
   | Amount | `$50` |

4. Set alert thresholds:

   | Threshold | % | Amount |
   |-----------|---|--------|
   | Alert 1 | 50% | $25 |
   | Alert 2 | 90% | $45 |
   | Alert 3 | 100% | $50 |

5. Under **Manage notifications** → check **Email alerts to billing admins and users**
   - Alerts go to `rakeshreddy.rakasi9308@gmail.com` automatically
6. Click **Finish**

**Time to complete:** ~2 minutes

---

## 🟡 Medium — Quality & Scale

### 12. Redis Caching (Cloud Memorystore)
**Problem:** Every API request hits Firestore — high read costs at scale, slow repeated queries.

**Cache candidates:**
- User profile by ID (TTL: 5 min)
- Search results by query hash (TTL: 1 min)
- Opportunity listings (TTL: 2 min)
- Notification unread count (TTL: 30s)

**Fix:**
1. Add Cloud Memorystore Redis to Terraform (`infra/terraform/cache.tf`)
2. `npm install ioredis` in backend
3. Create `backend/src/config/redis.ts`
4. Wrap Firestore reads with cache-aside pattern in each service

**Cost:** ~$35/month for smallest Redis instance (1GB)

---

### 13. API Documentation (Swagger)
**Problem:** No OpenAPI docs — frontend developers and external integrators have no reference.

**Fix:**
```bash
npm install swagger-ui-express @types/swagger-ui-express
```
- Generate OpenAPI spec from route schemas (Zod → OpenAPI via `zod-to-openapi`)
- Serve at `/api/docs` (restrict to non-production or add basic auth)

---

### 14. Google OAuth Sign-In
**Problem:** Only email/password — high friction for new users.

**Fix — Backend:**
- Add `GET /auth/google` → redirect to Google OAuth
- Add `GET /auth/google/callback` → exchange code for profile, upsert user, issue JWT

**Fix — Frontend:**
- Add "Continue with Google" button on Login + Signup pages

**Dependencies:** `passport`, `passport-google-oauth20`

---

### 15. CI Pipeline — Run Tests Before Deploy
**Problem:** Tests exist but are not run in GitHub Actions before deployment.

**Fix — add to `deploy-staging.yml` before the build steps:**
```yaml
- name: Run backend tests
  working-directory: backend
  run: npm ci && npm test -- --passWithNoTests

- name: Run frontend tests
  working-directory: frontend
  run: npm ci && npm test -- --passWithNoTests
```

---

### 16. GDPR — Data Deletion & Export
**Problem:** No way for users to delete their account or export their data — required by GDPR.

**Fix — Backend:**
- `DELETE /users/me` — hard delete: remove user doc, anonymize posts/comments, cancel applications
- `GET /users/me/export` — return JSON of all user data across collections

**Fix — Frontend:**
- Add "Delete Account" button in Settings/Profile with confirmation dialog
- Add "Export My Data" button

---

### 17. Geo-Radius Search
**Problem:** Frontend sends `radius_km` but backend ignores it — search always returns by city match only.

**Fix (Firestore approach):**
- Store `geohash` field on users and opportunities (use `geofire-common` library)
- Query by geohash prefix range for approximate radius filter
- Filter results in memory to exact radius

**Fix (PostgreSQL approach):**
- PostGIS `ST_DWithin` query (covered in `POSTGRES_MIGRATION.md`)

---

### 18. React Error Boundary
**Problem:** Unhandled React errors show blank white screen with no user feedback.

**Fix — create `frontend/src/components/ErrorBoundary.tsx`:**
```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError)
      return <div>Something went wrong. <button onClick={() => location.reload()}>Reload</button></div>;
    return this.props.children;
  }
}
```
Wrap `<App />` in `main.tsx` with `<ErrorBoundary>`.

---

## 🟢 Enterprise — When Scaling

### 19. Cloud Armor (WAF / DDoS Protection)
- Add Cloud Armor security policy to Cloud Run load balancer
- Rules: block known bad IPs, rate-limit by IP, geo-block if needed
- Cost: ~$5/month + per-request charges

### 20. VPC Private Networking
- Move Cloud Run services to a VPC
- Cloud SQL (when migrating to PostgreSQL) on private IP only
- No public internet access for internal services

### 21. Multi-Region Deployment
- Cloud Run supports multi-region with a global load balancer
- Firestore is already global (multi-region option available)
- Needed when user base spans multiple continents

### 22. Audit Log Enforcement
- `AuditLogDoc` type exists but verify all admin actions write to it
- Add middleware that auto-logs all `PATCH`/`DELETE` requests by admin role
- Export audit logs to BigQuery for compliance reporting

### 23. Mobile Apps (React Native)
- The REST API is already mobile-ready
- React Native with Expo — reuse most frontend logic
- Push notifications via FCM (Firebase Cloud Messaging)

### 24. Real-time Features (WebSockets)
- Messaging currently requires polling
- Add Socket.io or Cloud Pub/Sub for real-time message delivery
- Notification push via WebSocket instead of polling

### 25. Subscription / Payments
- `subscription_plan: "free" | "premium"` already in Organization model
- Integrate Razorpay (India) or Stripe for premium subscriptions
- Webhook handler for payment events

---

## Progress Tracker

Update this as items are completed:

| # | Item | Status | Completed |
|---|------|--------|-----------|
| 1 | SendGrid email delivery | ⏳ Pending | — |
| 2 | Password reset flow | ✅ Done — fully implemented, needs SendGrid (item 1) to deliver emails | — |
| 3 | Refresh token revocation | ⏳ Pending | — |
| 4 | Content Security Policy | ⏳ Pending | — |
| 5 | Frontend on CDN | ⏳ Pending | — |
| 6 | Sentry error tracking | ⏳ Pending | — |
| 7 | GCP alerting policies | ⏳ Pending | — |
| 8 | Firestore backups | ⏳ Pending | — |
| 9 | Account lockout | ⏳ Pending | — |
| 10 | Staging/prod separation | ⏳ Pending | — |
| 11 | GCP budget alerts | 📋 Drafted — manual GCP Console step | — |
| 12 | Redis caching | ⏳ Pending | — |
| 13 | API documentation | ⏳ Pending | — |
| 14 | Google OAuth | ⏳ Pending | — |
| 15 | Tests in CI pipeline | ⏳ Pending | — |
| 16 | GDPR deletion/export | ⏳ Pending | — |
| 17 | Geo-radius search | ⏳ Pending | — |
| 18 | React error boundary | ⏳ Pending | — |
| 19 | Cloud Armor WAF | ⏳ Pending | — |
| 20 | VPC private networking | ⏳ Pending | — |
| 21 | Multi-region | ⏳ Pending | — |
| 22 | Audit log enforcement | ⏳ Pending | — |
| 23 | Mobile apps | ⏳ Pending | — |
| 24 | Real-time WebSockets | ⏳ Pending | — |
| 25 | Payments/subscriptions | ⏳ Pending | — |
