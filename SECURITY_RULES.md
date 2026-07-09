# Security-First Vibe Coding Rules

Applies to every file generated/edited in this repo. When in doubt, security over convenience.
Referenced from `CLAUDE.md` MASTER RULES #11 — read on every task, not just security tasks.

## 1. Secrets & Env Vars
- [ ] No raw secret values in frontend code (`const API_KEY = "sk-..."` forbidden)
- [ ] Only `VITE_`-prefixed vars in frontend, none secret
- [ ] Backend secrets read via `process.env.VAR`, never returned in API responses
- [ ] `.env`, `.env.local`, `.env.*.local` in `.gitignore`
- [ ] `.env.example` kept in sync with real vars used
- [ ] Publishable/public keys (e.g. Stripe) commented as intentionally exposed

## 2. Rate Limiting
- [ ] Every public endpoint rate-limited
- [ ] Auth endpoints (login/register/reset): ~5 req/15min/IP
- [ ] General API: ~60 req/min/IP
- [ ] AI/LLM endpoints: ~10 req/min/user + daily budget
- [ ] File uploads: ~5 req/min/IP
- [ ] 429 + `Retry-After` header on limit hit; frontend shows message, never swallows

## 3. Input Validation
- [ ] All input validated server-side (client validation = UX only)
- [ ] Zod schema per mutating route, wired through `validate()` middleware
- [ ] Parameterized queries / ORM only — never raw string interpolation
- [ ] File uploads: MIME type + extension + size validated server-side
- [ ] Invalid input → 400 with clear error, log the attempt

## 4. Auth & Authorization
- [ ] Passwords hashed bcrypt (cost ≥12) or argon2, never plain text
- [ ] JWT_SECRET ≥32 chars from env, short access-token expiry (15m-1h)
- [ ] Refresh tokens in httpOnly cookies, never localStorage/response body
- [ ] Every request checks AuthN (who) + AuthZ (allowed to touch this resource)
- [ ] Account lockout / brute-force tracking on login
- [ ] Admin routes have explicit `requireRole("admin")` (never skip Admin Override rule)

## 5. SQL / DB Security
- [ ] ORM or parameterized queries only, never string-concat SQL
- [ ] DB user has least-privilege permissions
- [ ] Raw DB errors never returned to client

## 6. CORS
- [ ] No wildcard `*` origin in production
- [ ] Explicit origin allowlist from env
- [ ] Methods restricted to what each endpoint needs

## 7. HTTP Security Headers
- [ ] `helmet` (or equivalent) applied
- [ ] CSP configured (not blanket-disabled without a documented reason)
- [ ] `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, `Referrer-Policy`
- [ ] `X-Powered-By` removed

## 8. File Upload Safety
- [ ] MIME + extension validated server-side, size limits enforced server-side
- [ ] Stored outside web root / in cloud bucket, never executable
- [ ] Renamed to UUID, original filename never used directly
- [ ] Malware scan for sensitive/public uploads

## 9. Error Handling & Logging
- [ ] No stack traces / internal paths to client in production
- [ ] Generic user-facing error messages
- [ ] Structured server-side logging with context (timestamp, userId, route)
- [ ] 4xx vs 5xx used correctly (validation failures are never 500)

## 10. Dependency Security
- [ ] `npm audit` run after installs, high/critical fixed
- [ ] Lockfiles committed, versions pinned
- [ ] No unmaintained (2+ yr stale) security-relevant packages
- [ ] No packages with suspicious install scripts added without review

## 11. XSS Prevention
- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization
- [ ] No `eval()`, `new Function()`, dynamic `innerHTML`
- [ ] No inline `<script>` tags

## 12. Deploy Checklist (every deploy)
- [ ] `.env` not committed
- [ ] Secrets set in hosting platform env config
- [ ] Debug/dev logging OFF in production
- [ ] DB not publicly exposed
- [ ] HTTPS enforced
- [ ] Rate limiting active on all public endpoints
- [ ] CORS restricted to known origins
- [ ] Unused API routes removed or protected

## AI/LLM-Specific (this repo has an AI module)
- [ ] Raw user input sanitized before hitting LLM (prompt injection)
- [ ] `max_tokens` set on every LLM call
- [ ] API key server-side only, all calls routed through backend
- [ ] Token usage logged per user
- [ ] Per-user/session token budget enforced (persisted, not in-process only — survives restarts/scaling)
- [ ] LLM output sanitized before rendering (React auto-escaping is enough only for plain-text interpolation, not raw HTML injection)

---

## Known gaps in this app (found 2026-07-04 audit — fix before relying on above as "done")
- ~~**High**: refresh token stored in `localStorage`~~ — **Fixed**: httpOnly cookie (`backend/src/modules/auth/auth.routes.ts` `setRefreshCookie`, frontend reads nothing manually, `withCredentials: true`).
- ~~**High**: `scoring/backend/src/app.ts` CORS defaults to `*`~~ — **Fixed on re-check (2026-07-06)**: was already an explicit allowlist, not a wildcard, in both code and `terraform.tfvars.staging`/`.prod.example`; only issue was the env var being named `CORS_ORIGIN` (singular, unvalidated) instead of matching main backend's `CORS_ORIGINS` — renamed for consistency (`scoring/backend/src/app.ts`, `scoring/backend/src/lib/socket.ts`, `infra/terraform/cloudrun.tf`, both `docker-compose.yml`s, `scoring/backend/.env.example`).
- ~~**Medium**: CSP disabled (`contentSecurityPolicy: false`) in both `backend/src/app.ts` and `scoring/backend/src/app.ts`~~ — **Fixed**: both are pure JSON APIs (never serve HTML), now `default-src 'none'; frame-ancestors 'none'` as a defense-in-depth backstop.
- **Medium**: AI daily-budget rate limit (`backend/src/modules/ai/ai.service.ts`) is in-process `Map`, resets on restart, doesn't work across multiple instances.
- **Medium**: `POST /media/upload` legacy direct-buffer endpoint live in prod router, 100MB body limit, no dedicated rate limit — DoS vector.
- **Medium**: `/auth/refresh`, media upload routes, and `/ai/athlete-tips` rely only on the flat global rate limiter, no stricter dedicated limit.
- **High** (npm audit): `form-data`, `multer`, `nodemailer` in backend; `vitest`, `vite` (dev-only) in frontend.
- **Low**: main backend `cors()` code path still accepts `"*"` in `CORS_ORIGINS` env if ever misconfigured (currently not misconfigured in tfvars).
- ~~**Medium**: `backend/src/modules/users/users.routes.ts` `DELETE /:id/documents/:docId` has no `validate()` at all — neither param schema-checked.~~ — **Fixed on re-check (2026-07-09)**: already has `validate(documentParamSchema, "params")`.
- ~~**Low-medium**: `POST /:id/documents` — `type` field checked ad-hoc (`if (!type) throw...`), not Zod-validated (no enum/allowlist).~~ — **Fixed on re-check (2026-07-09)**: already validated via `z.enum(DOCUMENT_TYPES)` in `uploadDocumentBodySchema`.
- **Low**: `backend/src/modules/ai/ai.routes.ts` `POST /athlete-tips` has no `*.schemas.ts` / `validate()` — currently no body taken so low exploitability, but unguarded mutating route.
- **Low**: only `follow.service.ts` catches `PrismaClientKnownRequestError` (P2002/P2025) into proper 4xx; other modules' unique-constraint violations fall through to generic 500 (masked in prod, but wrong status class).
