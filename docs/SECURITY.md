# Sportivox — Security Controls

Direct mapping of SRS Section 8 controls to the implementation. Every row here is enforced in code; "where" points to the actual file.

## 8.1 Must-have controls

| SRS control | Implementation | Where |
|-------------|----------------|-------|
| JWT authentication on every protected API call | Bearer token verified by `requireAuth` middleware; mounted on all private routes | `backend/src/middleware/auth.ts`, applied per-router |
| Role-Based Access Control | `requireRole(...roles)` middleware + per-route ownership checks in services | `backend/src/middleware/auth.ts`, each `*.service.ts` |
| Bcrypt password hashing, min 12 salt rounds | `BCRYPT_ROUNDS` env validated to be 10-15; default 12; `hashPassword()` uses it | `backend/src/config/env.ts`, `backend/src/modules/auth/tokens.ts` |
| HTTPS / TLS enforced | Cloud Run terminates TLS automatically; nginx and Express bind to 8080 internal only | `infra/terraform/cloudrun.tf` |
| API rate limiting | Global limiter + stricter limiter on auth endpoints | `backend/src/middleware/rateLimit.ts` |
| Admin audit log | Every admin mutation calls `audit()` which writes to `audit_logs` | `backend/src/modules/admin/admin.service.ts` |

## 8.2 Additional controls

| SRS control | Implementation | Where |
|-------------|----------------|-------|
| File upload validation (type, size, content checks) | MIME whitelist per category + content-length limit + GCS `x-goog-content-length-range` enforcement in signed URL | `backend/src/modules/media/media.service.ts` |
| Server-side input validation on every API input | Zod schema per endpoint, applied via `validate()` middleware | `backend/src/middleware/validate.ts`, each `*.schemas.ts` |
| Protection against NoSQL injection | All Firestore queries use the typed SDK with `.where(field, op, value)` — no string concatenation, no raw query language | `backend/src/**/*.service.ts` |
| Sanitised outputs / XSS / CSRF | React escapes by default; markdown via `react-markdown` (no `dangerouslySetInnerHTML`); stateless JWT (no cookies → CSRF not applicable) | `frontend/src/pages/BlogDetail.tsx`, `backend/src/middleware/auth.ts` |
| Signed time-limited URLs for private S3 — *GCS* | Private docs bucket uses V4-signed read URLs (15-min TTL); public bucket is read-only via IAM | `backend/src/modules/media/media.service.ts`, `infra/terraform/storage.tf` |

## Extras (beyond SRS 8.2)

- **Refresh-token rotation**: each refresh single-use; old token revoked + new issued. Stored in `refresh_tokens` collection so password changes can revoke all sessions instantly.
- **Sensitive-field redaction in logs**: Pino redacts `authorization`, `cookie`, `password*`, `*token*` fields before they hit Cloud Logging.
- **CORS allowlist**: only the configured `CORS_ORIGINS` are allowed; same-origin/no-origin (curl, health probes) are permitted.
- **Helmet security headers**: `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security` (auto via Cloud Run), Referrer-Policy.
- **Public signup cannot create admin accounts**: `signupSchema` enum excludes "admin"; admins are bootstrap-created or made manually in Firestore.
- **Email verification gate**: accounts created `pending`; login fails until the user clicks the email link. Password reset flow revokes all sessions.
- **OpenAI cost control**: per-user rate limit (30s between calls, 20/day) prevents runaway costs since the SRS states billing is on the client's account.
- **Audit log immutability**: writes only via `audit()`, never updated/deleted from app code. Restrict the Firestore rules in prod to enforce this at the database level.

## Sensitive data treatment

KYC documents, government ID images, OpenAI prompt payloads, private messages, and contact details are all treated as sensitive:

- KYC + reg docs → private `sportivox-docs-*` bucket. Public access prevention enforced. Reads via signed URLs only.
- Private messages → Firestore `messages` collection. Only the two participants can read (`messaging.service.ts` enforces this). Admin can read for abuse review.
- OpenAI calls → key in Secret Manager; sent server-side only; the client never sees the key.
- Contact details → present only on the user's own profile responses and (for orgs) on opportunity listings as posted.

## Operational hardening checklist (post-launch)

- [ ] Enable Cloud Armor in front of Cloud Run for WAF-grade rate limit and bot defence.
- [ ] Set up Cloud Monitoring alerts on auth-error rate and 5xx percentage.
- [ ] Schedule daily `gcloud firestore export` to a backup bucket with versioning enabled.
- [ ] Add Cloud Scheduler job to expire stale `email_verifications` and `password_resets`.
- [ ] Configure Firestore Security Rules to deny **all** direct client access (the API is the only authorised principal — runtime SA gets `roles/datastore.user`).
- [ ] Run a pen-test before live launch — particularly the JWT/refresh path, upload validation, and admin routes.
- [ ] Rotate JWT secrets quarterly (re-apply Terraform after `terraform taint random_password.jwt_access`).
- [ ] Rotate the bootstrap admin password immediately after first login.
