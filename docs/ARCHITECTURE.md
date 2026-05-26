# Sportivox — Architecture

High-level: a containerized API + SPA, both running on Cloud Run, backed by Firestore and GCS.

```
                         ┌────────────────────────┐
                         │   Cloud Run (web)      │
   Browser  ─────────────►   nginx + React SPA    │
                         └─────────┬──────────────┘
                                   │ HTTPS (api base URL)
                         ┌─────────▼──────────────┐
                         │   Cloud Run (api)      │
                         │   Node.js + Express    │
                         └─────┬───────┬──────────┘
                               │       │
              ┌────────────────┘       └────────────────┐
              ▼                                         ▼
        ┌────────────┐                            ┌────────────┐
        │ Firestore  │                            │   GCS      │
        │ (Native)   │                            │ media + docs│
        └────────────┘                            └────────────┘
                                                        │ signed URLs
                                                        ▼
                                                   Browser PUT/GET
```

## Deviations from the SRS

1. **GCP instead of AWS.** Stakeholder direction. AWS S3 → Google Cloud Storage; AWS hosting → Cloud Run. Equivalent capability, simpler IAM story, scales-to-zero economics.
2. **Firestore instead of MongoDB.** Stakeholder direction. Native to GCP, scales to zero, no servers to manage. Trade-off: Firestore has no native full-text search, so multi-keyword search uses indexed equality filters + in-memory substring matching (good for thousands of candidates; Algolia/Elasticsearch upgrade path called out in SRS Section 5).

Both decisions are encapsulated; data access happens through service modules so swapping the persistence layer would touch ~10 files, not the whole codebase.

## Backend layout

```
backend/src/
  config/          Env validation (zod), Firestore client, GCS client, logger, mailer, OpenAI
  middleware/      auth (JWT, RBAC), validation (zod), rate limits, error handler, request id
  modules/
    auth/          signup/login/refresh/verify-email/forgot-password/change-password
    users/         profile CRUD, athlete/coach sub-fields
    follow/        follow / unfollow with counters
    organizations/ club + academy profiles
    opportunities/ CRUD + filters + auto-close on deadline
    applications/  state machine (pending→shortlisted→selected/rejected/withdrawn)
    search/        players / clubs / opportunities
    messaging/     conversations + messages
    notifications/ in-app + email
    posts/         activity logs + comments + likes
    reels/         short videos
    blogs/         markdown blog posts
    ai/            OpenAI tips with per-user rate limit
    media/         GCS signed-URL uploads
    verification/  KYC submission + admin review
    admin/         user moderation, audit log, reports, analytics
  types/           Shared domain types (Role, statuses, doc shapes)
  utils/           ids, errors, async wrapper
  scripts/seed.ts  Demo data for the emulator
  app.ts           Express app factory (testable)
  server.ts        Process bootstrap + graceful shutdown
```

## State machine — Applications

```
       ┌──────── withdrawn (athlete) ◄────────┐
       │                                       │
       ▼                                       │
   pending ─────────► shortlisted ─────────► selected
       │                  │                    │
       │                  │                    │
       └────► rejected ◄──┘                    │
                                               │
                          (vacancy decrements; opp -> filled when full)
```

- Only the **poster** (or admin) can shortlist/select/reject.
- Only the **applicant** (or admin) can withdraw.
- Selecting decrements `vacancies_filled`; withdrawing from `selected` restores it.

## Firestore index strategy

Firestore requires composite indexes for every `.where().where().orderBy()` query. All indexes used by the code are defined in `infra/terraform/firestore.tf`, so applying Terraform is necessary before the API will serve filtered queries in production.

## Frontend layout

```
frontend/src/
  api/client.ts   Axios with refresh-token rotation
  store/auth.ts   Zustand auth store (persisted)
  components/     Layout, ProtectedRoute, UI primitives
  pages/          Routes — one file per page
  pages/admin/    Admin moderation screens
  styles.css      Tailwind base + custom component classes
```

## Operational notes

- **Cold starts:** Cloud Run scale-to-zero means first request after idle takes ~700ms on Node 20. Bump `min_instances_api` to 1 if you need predictable latency.
- **Logs:** Structured Pino logs flow to Cloud Logging. Request IDs are propagated via `X-Request-Id`.
- **Backups:** Firestore exports must be scheduled separately (see `gcloud firestore export`). Not provisioned by Terraform — add for production.
- **Custom domains:** Map a custom domain to each Cloud Run service via the Cloud Run console or `gcloud run domain-mappings create`. Don't forget to update `WEB_APP_URL` / `CORS_ORIGINS` afterward.
