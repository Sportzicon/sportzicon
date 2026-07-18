# Sportzicon — Project Handover Document

**Prepared:** 2026-07-18
**Prepared by:** Mahesh Singare, FullStack Developer — singaremahesh@gmail.com
**Owner:** EASOPS Technologies PVT LTD — Strictly Confidential
**Production:** GCP Cloud Run · PostgreSQL (Supabase) · Google Cloud Storage · domain `sportzicon.com`

This document is the single entry point for taking over operation, maintenance,
and further development of the Sportzicon platform. It complements — not
replaces — [`README.md`](README.md) (setup/reference), [`CLAUDE.md`](CLAUDE.md)
(coding rules for AI-assisted development), and [`SECURITY_RULES.md`](SECURITY_RULES.md)
(security checklist).

## Table of Contents

1. [What This Platform Is](#1-what-this-platform-is)
2. [Architecture](#2-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Backend Module Reference](#4-backend-module-reference)
5. [Frontend Module Map](#5-frontend-module-map)
6. [Event-Driven Architecture & State Machines](#6-event-driven-architecture--state-machines)
7. [Running It Locally](#7-running-it-locally)
8. [Environment Variables](#8-environment-variables)
9. [Database](#9-database)
10. [Deployment & CI/CD](#10-deployment--cicd)
11. [Testing](#11-testing)
12. [Security Summary](#12-security-summary)
13. [Onboarding Checklist — First Week](#13-onboarding-checklist--first-week)
14. [Troubleshooting / Runbook](#14-troubleshooting--runbook)
15. [Glossary](#15-glossary)
16. [What the New Owner Needs to Take Over](#16-what-the-new-owner-needs-to-take-over)
17. [Where to Go Next](#17-where-to-go-next)

---

## 1. What This Platform Is

A multi-role sports recruitment and networking platform for the Indian sports
market, plus an integrated cricket live-scoring console.

| Role | What they do |
|---|---|
| Athlete | Verified profile, apply to opportunities, post/reels/blogs, follow network |
| Club / Academy | Post trials/scholarships/tournaments, manage application pipeline, search athletes |
| Scout | Search athletes, follow, message, shortlist |
| Organizer | Post events, manage scoring console, tournament brackets |
| Scorer | Live ball-by-ball cricket scoring console |
| Admin | User moderation, identity verification, audit log, full override on every role restriction |

---

## 2. Architecture

Three independently deployable services in one monorepo, one shared Postgres database:

```
Browser ──► React SPA (Vite)
                │
                ├── /api/v1/*      ──► Main API (Express + Node.js 20)
                │                          ├── PostgreSQL (Supabase, "public" schema)
                │                          ├── Google Cloud Storage
                │                          └── Resend (email)
                │
                └── /scoring-api/* ──► Scoring Backend (Express + Node.js)
                                            └── Same PostgreSQL, "scoring" schema
```

- `database/prisma/schema.prisma` is the **single source of truth** for both
  schemas (Prisma `multiSchema`). `backend/prisma/schema.prisma` and
  `scoring/backend/prisma/schema.prisma` are generated local copies — never
  edit those directly.
- Scoring frontend auth is SSO with the main app: the scoring backend issues
  its **own** JWTs (`JWT_SECRET`), but trusts the main app's access token
  during the SSO handshake via `MAIN_JWT_SECRET`, which must equal the main
  backend's `JWT_ACCESS_SECRET`. Scoring has no database of its own — it
  shares the main Postgres instance under the `scoring` schema.

### Repo layout

```
backend/       Main API — src/{config,events,lib,middleware,modules,repositories,utils,workflows}
frontend/      React SPA — src/{api,components,hooks,models,pages,services,store,modules}
scoring/       Cricket scoring subsystem (backend port 4000, frontend port 5174)
database/      Single Prisma schema (multiSchema: public + scoring)
infra/         Terraform IaC (infra/terraform/) + infra/cloudbuild.yaml
e2e/           Playwright suite covering both SPAs
docs/          ARCHITECTURE.md, SCALING_PLAN.md, scaling-architecture-analysis.md
scripts/       Utility scripts
```

Backend: 16 self-contained feature modules under `backend/src/modules/`:
auth, users, organizations, opportunities, applications, **content** (unifies
posts/reels/blogs under one `Content` model + a `content_type` field, plus a
sibling `comments` sub-module), follow, messaging, notifications, search,
media, verification, admin, email-logs. Each module has `<name>.routes.ts`,
`<name>.service.ts`, `<name>.schemas.ts`. Full endpoint-by-endpoint detail:
[§4](#4-backend-module-reference).

> **Naming note:** `README.md` and `CLAUDE.md`'s original build prompts refer
> to separate "posts", "reels", and "blogs" modules. The codebase as actually
> built merged all three into one `content` module (`backend/src/modules/content/`)
> distinguished by a `content_type` enum field, with comment handling split
> out into its own `comments.routes.ts` in the same folder. This handover
> document reflects the real code; treat this section as authoritative over
> that older module naming.

Frontend: feature-sliced under `frontend/src/modules/<feature>/` (auth,
landing, dashboard, profile, opportunities, applications, tournaments,
organizations, feed, reels, blogs, comments, messaging, notifications,
search, admin, live-scoring — plus `documentAccess`, not in the original
module list but present in the code), with a shared kernel in the root
`components/`, `hooks/`, `services/`, `models/`, `store/`, `api/`, `data/`,
`utils/`. Full module map: [§5](#5-frontend-module-map).

Full architectural detail, design patterns used, and pattern locations: see
[`README.md`](README.md#design-patterns) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## 3. Technology Stack

| Layer | Stack |
|---|---|
| Backend | Node.js 20, TypeScript 5, Express 4, Prisma 5, Zod 3, JWT, bcryptjs, Pino |
| Frontend | React 18, Vite 5, TypeScript 5, TanStack React Query 5, Zustand 4, Tailwind 3, react-hook-form + Zod, React Router 6 |
| Database | PostgreSQL 15/16, hosted on Supabase (production), Prisma Migrate |
| Storage | Google Cloud Storage (media, private documents via signed URLs) |
| Infra | Docker/Docker Compose (local), GCP Cloud Run (hosting), Terraform (IaC), GitHub Actions (CI) + Google Cloud Build (image build) |
| Email | Resend (`RESEND_API_KEY`) — blank key runs in stub mode (logged, not sent) |

---

## 4. Backend Module Reference

All routes are mounted under `/api/v1` (see `backend/src/app.ts`). Role
column shorthand: **public** = no auth, **auth** = any logged-in user
(`requireAuth`), **optional** = works logged-out with reduced data
(`optionalAuth`), a `ROLES.*` name = `requireRole(...ROLES.X)`, **owner/admin**
= ownership check inside the service (not middleware) — the resource's
owner or an admin, enforced by the pattern in
[Master Rule #1](CLAUDE.md#1-admin-override-critical).

`ROLES` groups (`backend/src/utils/roles.ts`):

| Group | Roles included |
|---|---|
| `ALL` | athlete, club, scout, organizer, scorer, admin |
| `CONTENT_CREATORS` | athlete, club, organizer, admin |
| `RECRUITERS` | club, scout, organizer, admin |
| `CLUB_MANAGERS` | club, organizer, admin |
| `SCORERS` | scorer, admin |
| `ATHLETES_AND_ADMIN` | athlete, admin |

### auth — `/api/v1/auth`

| Method + Path | Purpose | Access |
|---|---|---|
| POST /check-availability | check email/phone availability | public |
| POST /register/basic | signup step 1: email/phone/password/location | public |
| POST /register/profile | signup step 2: sport/org profile, sends verification email | public |
| POST /login | login, sets refresh-token cookie | public |
| POST /refresh | rotate access token from refresh cookie | public |
| POST /logout | clear session | public |
| POST /verify-email | verify email via token | public |
| POST /guardian-consent/confirm | confirm minor athlete's guardian consent | public |
| POST /resend-verification | resend verification email | public |
| POST /forgot-password | request password reset | public |
| POST /reset-password | reset password via token | public |
| POST /change-password | change password while logged in | auth |
| GET /me | current user | auth |

Emits `GUARDIAN_CONSENT_APPROVED` when a guardian confirms consent for a minor.

### users — `/api/v1/users`

| Method + Path | Purpose | Access |
|---|---|---|
| GET /:id | get user profile | auth |
| PUT /me | update own profile | auth |
| PUT /me/athlete | update athlete-specific fields | auth |
| PUT /me/coach | update coach-specific fields | auth |
| POST /me/scorecard-link-preview | preview an external scorecard link | auth (rate-limited) |
| GET /:id/documents | list a user's documents | self, admin, or approved doc-access grant |
| POST /:id/documents | upload a document | self only |
| DELETE /:id/documents/:docId | delete document | self or admin |
| GET /:id/tournaments | personal tournament history | auth |
| POST /:id/tournaments | add tournament entry | self only |
| PUT /:id/tournaments/:tournamentId | update tournament entry | self or admin |
| DELETE /:id/tournaments/:tournamentId | delete tournament entry | self or admin |

### organizations — `/api/v1/organizations`

| Method + Path | Purpose | Access |
|---|---|---|
| POST / | create organization | `CLUB_MANAGERS` |
| GET / | list/search organizations | auth |
| GET /mine | orgs owned by current user | auth |
| GET /:id | get organization | auth |
| PUT /:id | update organization | owner/admin |
| DELETE /:id | delete organization | owner/admin |
| POST /:id/documents | add org document | owner/admin |
| GET /:id/documents | list org documents | owner/admin |

### opportunities — `/api/v1/opportunities`

| Method + Path | Purpose | Access |
|---|---|---|
| POST / | create opportunity | `CLUB_MANAGERS` |
| GET /mine | opportunities posted by current user | `CLUB_MANAGERS` |
| GET / | list/filter opportunities | optional |
| GET /:id | opportunity detail | optional |
| PUT /:id | update opportunity | owner/admin |
| DELETE /:id | delete opportunity | owner/admin |
| PATCH /:id/scoring-link | link/unlink a live-scoring tournament | `CLUB_MANAGERS` |

Emits `application.status_changed` when an opportunity auto-reopens (status
→ `open`) because a selected applicant withdraws or is rejected, freeing a
vacancy. State transitions: [§6](#6-event-driven-architecture--state-machines).

### applications — flat under `/api/v1`

| Method + Path | Purpose | Access |
|---|---|---|
| POST /opportunities/:opportunityId/apply | submit application | `ATHLETES_AND_ADMIN` |
| GET /applications/mine | current user's applications | auth |
| GET /applications/:id | application detail | participant/admin |
| PATCH /applications/:id/status | transition application status | poster/applicant/admin |
| GET /opportunities/:opportunityId/applicants | list applicants for an opportunity | poster/admin |

Emits `APP_APPLIED` (notifies poster) on submit, `APP_TRANSITIONED` (notifies
applicant) on every status change. Full state machine: [§6](#6-event-driven-architecture--state-machines).

### content — `/api/v1/content` + `/api/v1/comments` (posts, reels, blogs, unified)

| Method + Path | Purpose | Access |
|---|---|---|
| POST /content | create content (post/reel/blog) | auth |
| GET /content/feed | unified mixed post/reel/blog feed | auth |
| GET /content | list/filter content | optional (blogs public; posts/reels require auth) |
| GET /content/:id | get content by id | optional (same rule) |
| PUT /content/:id | update content | author/admin |
| DELETE /content/:id | delete content | author/admin |
| PATCH /content/:id/hidden | hide/unhide content | author/admin |
| POST /content/:id/like | like content | auth |
| DELETE /content/:id/like | unlike content | auth |
| GET /content/:id/comments | list comments | optional |
| POST /content/:id/comments | add comment | auth |
| PUT /comments/:id | edit comment | author/admin |
| DELETE /comments/:id | delete comment | author/admin |
| POST /comments/:id/like | like comment | auth |
| DELETE /comments/:id/like | unlike comment | auth |

Emits `CONTENT_LIKED` on like, notifying the content author (post/blog/reel,
link varies by `content_type`).

### follow — `/api/v1/follow`

| Method + Path | Purpose | Access |
|---|---|---|
| POST /:id | follow a user | auth |
| DELETE /:id | unfollow a user | auth |
| GET /:id/followers | list followers | auth |
| GET /:id/following | list following | auth |
| GET /status/:id | check if current user follows :id | auth |

Emits `USER_FOLLOWED` on follow, notifying the followee.

### messaging — flat under `/api/v1`

| Method + Path | Purpose | Access |
|---|---|---|
| GET /conversations | list current user's conversations | auth |
| POST /conversations | create a conversation (no message) | auth |
| POST /messages | send a message (auto-creates conversation) | auth |
| GET /conversations/:id/messages | paginated messages | auth |
| POST /conversations/:id/read | mark conversation read | auth |

Emits `MESSAGE_SENT` on send, notifying the recipient.

### notifications — `/api/v1/notifications`

| Method + Path | Purpose | Access |
|---|---|---|
| GET / | list notifications (paginated) | auth |
| GET /count | unread count | auth |
| PATCH /read-all | mark all read | auth |
| PATCH /:id/read | mark one read | auth |
| POST /read | legacy mark-read by id list | auth |

This module only *consumes* events (via `notificationHandler.ts`) — it emits nothing itself.

### search — `/api/v1/search`

| Method + Path | Purpose | Access |
|---|---|---|
| GET /users | generic user search (messaging/mentions) | auth |
| GET /players | athlete search — sport/location/experience filters | auth |
| GET /clubs | club/academy search | auth |
| GET /opportunities | opportunity search | auth |

### media — `/api/v1/media`

| Method + Path | Purpose | Access |
|---|---|---|
| POST /upload-url | get GCS signed PUT URL | auth |
| POST /confirm | verify upload landed, return public URL | auth |
| GET /download-url/:key | signed URL for a private org document | auth |
| POST /upload | legacy direct-buffer upload (test helper only) | auth |

### verification — `/api/v1/verifications`

| Method + Path | Purpose | Access |
|---|---|---|
| POST / | submit verification request (user or org) | auth |
| GET /pending | list pending verifications | admin |
| POST /:id/review | approve/reject a verification | admin |
| PATCH /:orgId/approve | approve org verification | admin |
| PATCH /:orgId/reject | reject org verification (reason required) | admin |

Emits `org.verified` and `org.verification_rejected`. **Note:** unlike every
other event in the system, these two are not wired to `notificationHandler.ts`
— the verification service creates the user-facing notification directly.
Worth knowing if you're debugging "why didn't org verification notify
anyone the same way follows/likes do."

### admin — `/api/v1/admin` + `/api/v1/reports`

Every route under `admin.routes.ts` is gated by
`router.use(requireAuth, requireRole("admin"))` at the router level — no
per-route role checks to audit individually.

| Method + Path | Purpose |
|---|---|
| POST /users | admin-create a user |
| GET /users | list users (filter by status/role/search) |
| PATCH /users/:id/status | set user status |
| PATCH /users/:id/suspend | suspend user (reason required) |
| PATCH /users/:id/unsuspend | unsuspend user |
| PATCH /users/:id/guardian-consent/approve | approve guardian consent |
| PATCH /users/:id/activate | activate user |
| PATCH /users/:id/badges | set user badges |
| DELETE /users/:id | delete user |
| GET /users/:id | admin user detail |
| PATCH /users/:id/profile | admin edit user profile |
| PATCH /users/:id/role | change user role |
| DELETE /posts/:id | moderation: delete a post |
| DELETE /reels/:id | moderation: delete a reel |
| GET /reports | list content/user reports |
| PATCH /reports/:id/resolve | resolve report (warned/suspended/dismissed) |
| PATCH /reports/:id | legacy resolve endpoint (actioned/dismissed) |
| GET /audit-log, GET /audit-logs | list audit logs (second is a legacy alias) |
| GET /analytics | platform analytics |
| POST /opportunities, GET /opportunities, PATCH /opportunities/:id, DELETE /opportunities/:id | admin CRUD over opportunities |
| POST /organizations, GET /organizations, PATCH /organizations/:id | admin CRUD over organizations |
| GET /applications, PATCH /applications/:id/status | admin view/transition of applications |

`reports.routes.ts` (`/api/v1/reports`): `POST /` — file a report against a
user/org/post/reel/blog/message/opportunity (auth, any role).

Emits `GUARDIAN_CONSENT_APPROVED` when an admin approves guardian consent.

### email-logs — flat under `/api/v1`

| Method + Path | Purpose | Access |
|---|---|---|
| GET /users/:id/email-logs | email logs + stats for a user | self or admin |
| GET /email-logs | global email log view + stats | admin |

---

### Shared backend infrastructure

**`backend/src/lib/EventBus.ts`** — In-process pub/sub: a `Map<eventName, handler[]>`.
`.on(event, handler)` registers an async handler; `.emit(event, payload)` is
fire-and-forget — the calling service does not `await` it. Internally it runs
every registered handler via `Promise.all` and catches/`logger.warn`s any
handler failure, so a broken notification handler can never break the
service's core transaction (e.g. an application status change still commits
even if the notification insert throws). Exposed as a single singleton,
`eventBus`.

**`backend/src/lib/StateMachine.ts`** — Generic `StateMachine<S>`: built from
an initial state plus an array of `{ from: S | S[], to: S, guard? }`
transitions. `.can(next)` checks legality without mutating state;
`.transition(next, context)` finds a matching transition, runs its optional
async `guard(context)`, throws `BadRequest("Illegal transition")` if none
matches or the guard fails, otherwise mutates `.current` and runs any
listeners registered via `.on(state, listener)` for the new state, awaited
in sequence. Used by both the application workflow and the opportunity
workflow — never hand-roll transition `if`/`else` logic in a service; add a
transition + guard to the relevant `workflows/*.ts` file instead.

**`backend/src/events/handlers/notificationHandler.ts`** —
`registerNotificationHandlers()`, called once at startup, wires 8 event
types to `createNotification(...)`. Full table in
[§6](#6-event-driven-architecture--state-machines).

**`backend/src/repositories/`** — Repository pattern for 4 modules only
(application, opportunity, notification, user). `index.ts` wires 4
Prisma-backed singletons under `repositories.{application,opportunity,notification,user}`.

| Interface (`interfaces/`) | Key methods |
|---|---|
| `IApplicationRepository` | findById, findByOpportunityAndApplicant, findManyByApplicant, findManyByOpportunity, create, update |
| `IOpportunityRepository` | findById, findMany, create, update, delete, incrementApplicationCount, updateStatus, updateVacanciesFilled |
| `INotificationRepository` | create, findManyByUser, countUnread, markRead, markOneRead, deleteOlderThan |
| `IUserRepository` | findById, findByEmail, updateAthleteData |

Each has a 1:1 Prisma implementation under `repositories/prisma/`. Per
`CLAUDE.md`, these four modules must never import `prisma` directly — always
go through the repository interface, so they stay swappable with mocks in tests.

**`backend/src/middleware/`**

| File | Purpose |
|---|---|
| `auth.ts` | `requireAuth`, `optionalAuth`, `requireRole(...roles)` |
| `errorHandler.ts` | Central error handler — `HttpError` → status/code/message, `ZodError` → 422 with cleaned field messages, else logs + generic 500 |
| `notFound.ts` | Catch-all 404 JSON responder |
| `rateLimit.ts` | `apiLimiter`, `authLimiter`, `linkPreviewLimiter` — Redis-backed when `REDIS_URL` set, in-memory fallback, fails open on Redis errors |
| `requestId.ts` | Assigns/propagates `X-Request-Id` for log correlation |
| `validate.ts` | `validate(zodSchema, target)` — parses body/query/params, replaces the field or forwards the `ZodError` |

Middleware chain on every protected route: `requireAuth` → `requireRole(...)`
→ `validate(schema)` → `asyncHandler(handler)`.

---

## 5. Frontend Module Map

Feature-sliced under `frontend/src/modules/<name>/{pages,hooks,services,components}/`.

| Module | Pages | Hooks | Services | Components |
|---|---|---|---|---|
| auth | ForgotPassword, GuardianConsentConfirm, Login, ResetPassword, Signup, VerifyEmail | — | auth.service.ts | — |
| landing | HowItWorks, Landing | — | — | — |
| dashboard | Dashboard | — | — | — |
| profile | EditProfile, Profile | useDocuments, useScorecardLinks, useTournaments | user.service.ts | AddScorecardLinkDrawer, AddTournamentDrawer, ProfileFeedTab, TileGrid |
| opportunities | NewOpportunity, Opportunities, OpportunityDetail | useOpportunities | opportunity.service.ts | — |
| applications | Applicants, MyApplications | useApplications | application.service.ts | — |
| tournaments | NewTournament, Tournaments | useOrgTournaments | tournament.service.ts | — |
| organizations | MyOrganizations, NewOrganization, OrganizationDetail, Organizations | — | organization.service.ts | — |
| feed | Feed | useFeed | post.service.ts | MediaCarousel, PostComposer, PostContentView |
| reels | Reels | useReels | reel.service.ts | ImageUpload, ReelViewer, VideoUpload |
| blogs | BlogDetail, Blogs, NewBlog | useBlogs | blog.service.ts | BlogFormFields, RichMarkdownEditor |
| comments | — | useComments | comment.service.ts | CommentSection |
| messaging | Messages | useMessages | message.service.ts | — |
| notifications | Notifications | useNotifications | notification.service.ts | — |
| search | Search | useSearch | search.service.ts | — |
| admin | Admin, AdminApplications, AdminAuditLog, AdminCreateOpportunity, AdminCreateOrganization, AdminCreateUser, AdminOpportunities, AdminOrganizations, AdminReports, AdminScoring, AdminUserDetail, AdminUsers, AdminVerifications | — | — | Wizard |
| live-scoring | LiveScoreDetail, LiveScores, ScoringAllMatches, ScoringGate, ScoringHome, ScoringInningsAnalytics, ScoringLive, ScoringMatchConfig, ScoringMatchDetail, ScoringNewTournament, ScoringPlayerStats, ScoringTournamentDetail, ScoringTournaments | — | scoring.service.ts | — |

(`documentAccess` also exists as a module, outside the original 16.)

### `frontend/src/hooks/queryKeys.ts`

Single exported `queryKeys` object, one factory function per cache-key
family, grouped by domain in comments — 60+ keys total, pattern
`keyName: (args?) => [...] as const`, so filter params bake into the tuple
for automatic per-filter cache segregation. Groups: Feed/Posts,
Opportunities, Applications, Blogs, Reels, Messages, Notifications,
Organizations, Users/Profile, Comments, Search, Admin (7 keys), Tournaments
(org-tournaments — distinct from the opportunity `type: "tournament"`),
Org sub-resources, Public, Live scores (public, no-auth), Scoring subsystem
(13 keys — its own auth context: matches, tournaments, innings, XI,
player-stats, analytics). No shared factory helper — every entry is
hand-written; this is the **only** allowed source of cache keys anywhere in
the frontend (Master Rule #5).

### `frontend/src/store/` (Zustand)

| Store | Holds | Persisted? |
|---|---|---|
| `auth.ts` | `user`, `accessToken`, `hasHydrated` | Yes — `sportivox.auth`, user+token only |
| `favorites.ts` | `favoriteReels: Set<string>` | Yes — `favorites-store`, custom Set↔Array serializer |
| `notifications.ts` | `unreadCount: number` | No — in-memory badge count only |
| `savedOpportunities.ts` | `saved: Opportunity[]` | Yes — `sx_saved_opps` |
| `scoringAuth.ts` | `scoringUser`, `accessToken` | Yes — `scoring-auth`, kept parallel to (not merged with) main `auth.ts` since scoring issues its own SSO-exchanged tokens |

---

## 6. Event-Driven Architecture & State Machines

### How notifications actually get created

Nothing calls `createNotification()` directly from the module that triggers
the event. Instead: a service emits a named event on the singleton
`eventBus`, and `notificationHandler.ts` — registered once at startup —
listens for it and creates the notification. This keeps `applications.service.ts`
ignorant of how notifications work, and means a broken notification write
never rolls back the actual business transaction (an application status
change commits regardless of whether the notification insert succeeds).

| Event | Emitted by | Handled by `notificationHandler.ts`? | Notifies |
|---|---|---|---|
| `APP_APPLIED` | applications.service.ts, on submit | Yes | Opportunity poster |
| `APP_TRANSITIONED` | applications.service.ts, on every status change | Yes | Applicant |
| `USER_FOLLOWED` | follow.service.ts, on follow | Yes | Followee |
| `MESSAGE_SENT` | messaging.service.ts, on send | Yes | Recipient |
| `CONTENT_LIKED` | content.service.ts, on like | Yes | Content author |
| `GUARDIAN_CONSENT_APPROVED` | auth.service.ts (self-confirm) / admin.service.ts (admin-approve) | Yes | The minor athlete |
| `DOC_ACCESS_REQUESTED` | document-access flow | Yes | Athlete whose document was requested |
| `DOC_ACCESS_DECIDED` | document-access flow | Yes | Requester, on approve/reject/revoke |
| `application.status_changed` | opportunities.service.ts, on auto-reopen | **No dedicated handler** | — |
| `org.verified` | verification.service.ts, on approve | **No dedicated handler** — notification created directly in-service | Org owner |
| `org.verification_rejected` | verification.service.ts, on reject | **No dedicated handler** — notification created directly in-service | Org owner |

If you're extending notifications for a new event: register a listener in
`notificationHandler.ts` rather than creating the notification inline in the
emitting service — that's the established pattern for 8 of the 11 events
above, and the 3 exceptions are the ones worth normalizing if you touch
that code.

### Application state machine

`lib/StateMachine.ts` + `workflows/applicationWorkflow.ts`. Transitions
(`APPLICATION_TRANSITIONS`):

| From | To | Who |
|---|---|---|
| pending | shortlisted | poster (club/organizer/admin) |
| pending | rejected | poster |
| shortlisted | selected | poster |
| shortlisted | rejected | poster |
| pending, shortlisted | withdrawn | applicant |

`selected`, `rejected`, and `withdrawn` are terminal — any further transition
attempt throws `BadRequest("Illegal transition")`. Notification copy per
landing state (shortlisted/selected/rejected, whether each also triggers an
email) is centralized in `APPLICATION_NOTIFICATIONS` in the same workflow
file — edit copy there, not in the service.

### Opportunity state machine

`workflows/opportunityWorkflow.ts` (`OPPORTUNITY_TRANSITIONS`) governs
`open → filled → closed` and the auto-reopen path back to `open` when a
`selected` applicant withdraws or is rejected, freeing a vacancy — this is
the one case where the opportunities module itself emits
`application.status_changed` rather than the applications module.

---

## 7. Running It Locally

Prerequisites: Docker + Docker Compose, Node.js 20+.

```bash
make install    # backend + frontend npm install
make dev        # docker compose up --build — starts API (8080), web (5173), scoring backend, GCS emulator
make seed       # seed demo users/org/opportunities
```

Open http://localhost:5173.

Individual services:
```bash
cd backend && npm run dev          # API on :8080
cd frontend && npm run dev         # Vite on :5173
cd scoring/backend && npm run dev  # Scoring API on :4000
cd scoring/frontend && npm run dev # Scoring UI on :5174
```

Note: local Postgres is **not** started by `docker-compose.yml` — production
uses Supabase, and local dev is expected to point `DATABASE_URL` at either a
local Postgres container you run yourself (command is documented inline in
`docker-compose.yml`) or a dev Supabase instance.

### Demo accounts (password `Demo1234!` for all)

| Email | Role |
|---|---|
| `admin@sportivox.local` | Admin |
| `athlete@demo.sportivox` | Athlete |
| `club@demo.sportivox` | Club |
| `scout@demo.sportivox` | Scout |
| `admin@scoring.local` | Scoring admin (seeded by scoring backend's own seed script) |

---

## 8. Environment Variables

Four `.env` files, one per service. Each has a matching `.env.example` in
its folder — copy and fill in real values, never commit the real `.env`.

### `backend/.env`

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Yes | Supabase connection strings. `DATABASE_URL` goes through pgbouncer (port 6543), `DIRECT_URL` is the direct connection (port 5432, used for migrations) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Yes | Min 16 chars, use `openssl rand -base64 48` in production |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | No | Default `15m` / `30d` |
| `BCRYPT_ROUNDS` | No | Default 12, SRS requires ≥12 |
| `CORS_ORIGINS` | Yes | Comma-separated allowlist, no wildcards |
| `COOKIE_DOMAIN` | No | Leave unset for single-host deploys |
| `RATE_LIMIT_*` | No | Defaults are production-appropriate; local dev is relaxed |
| `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | Yes (prod) | GCS auth |
| `GCS_BUCKET_MEDIA`, `GCS_BUCKET_DOCS`, `GCS_SIGNED_URL_TTL_MIN`, `MAX_UPLOAD_MB` | Yes | Storage config |
| `RESEND_API_KEY` | No | Email stub mode (logged only) if blank |
| `REDIS_URL` | No | Caching disabled (app runs identically, just uncached) if blank |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` | First run only | Clear after first admin is created |

### `frontend/.env`

| Var | Required | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Main API base URL |
| `VITE_SCORING_API_URL` | Yes (build-time, prod) | Set via Docker build-arg in CI, see `deploy-production.yml` |

### `database/.env`

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Used by `prisma migrate` commands run from `backend/` or `database/` |

### `scoring/backend/.env`

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Yes | **Must match** the main backend's — same physical database, different schema |
| `JWT_SECRET` | Yes | Scoring's own token signing secret |
| `MAIN_JWT_SECRET` | Yes | **Must match** main backend's `JWT_ACCESS_SECRET` — enables SSO |
| `CORS_ORIGINS` | Yes | Scoring frontend origin |
| `REDIS_URL` | No | Only needed for multi-instance Socket.io adapter |

---

## 9. Database

- Single Prisma schema, single Postgres database, two Postgres **schemas**:
  `public` (main app) and `scoring` (cricket scoring), declared via Prisma's
  `multiSchema` feature in `database/prisma/schema.prisma`.
- Migrations live under `database/prisma/migrations` and are shared — the
  scoring backend has no migration history of its own.

```bash
cd backend && npx prisma migrate dev --name describe_change   # new migration (dev)
cd backend && npx prisma migrate deploy                        # apply pending (prod)
cd backend && npx prisma studio                                 # GUI browser
cd scoring/backend && npm run db:generate                       # after schema.prisma changes: copies schema in + regenerates client
```

Never edit `backend/prisma/schema.prisma` or `scoring/backend/prisma/schema.prisma`
directly — they're generated copies of `database/prisma/schema.prisma`.

Indexing: composite B-tree indexes on hot query shapes (`perf_add_indexes`
migration), Postgres full-text search with GIN indexes on User/Organization/Opportunity
(`add_fts_indexes` migration), GIN index on `athlete_data` JSONB.

Repository pattern (see [§4](#4-backend-module-reference)) covers only 4
tables (application, opportunity, notification, user) — every other module
queries Prisma directly from its `.service.ts`.

---

## 10. Deployment & CI/CD

### Pipeline

```
push → main    → GitHub Actions CI (typecheck + build)
                → deploy-staging.yml   (auto: migrate DB → build+push 3 images → terraform apply, staging env)

push → master  → deploy-production.yml (migrate DB → build+push 3 images →
                  MANUAL APPROVAL gate ["production-approval" GitHub environment] →
                  terraform apply → health checks → GitHub Release)
```

Three container images built and pushed to Artifact Registry per deploy:
API (`backend/Dockerfile`), Web (`frontend/Dockerfile`), Scoring API
(`scoring/backend/Dockerfile`).

### Required GitHub repo secrets (Settings → Secrets and variables → Actions)

| Secret | Purpose |
|---|---|
| `GCP_PROJECT_ID` | Target GCP project |
| `GOOGLE_PROVIDER_NAME`, `GOOGLE_SERVICE_ACCOUNT` | Workload Identity Federation — no long-lived key file |
| `DATABASE_URL`, `DIRECT_URL` | Supabase connection strings for the target environment |
| `RESEND_API_KEY` | Email sending |

Also requires the `production` and `production-approval` GitHub Environments
to exist (the latter is where whoever approves prod deploys clicks "Approve").

### Manual deploy / infra provisioning

```bash
gcloud builds submit . --config infra/cloudbuild.yaml \
  --substitutions=_REGION=asia-south1,_AR_REPO=sportivox,\
_API_SERVICE=sportivox-api-prod,_WEB_SERVICE=sportivox-web-prod,\
_API_PUBLIC_URL=https://api.sportzicon.com,_WEB_APP_URL=https://sportzicon.com

cd infra/terraform
cp terraform.tfvars.prod.example terraform.tfvars.prod   # already filled for sportzicon.com
terraform init
terraform plan -var-file=terraform.tfvars.prod
terraform apply -var-file=terraform.tfvars.prod
```

Terraform (`infra/terraform/`) provisions: Cloud Run services (API, Web,
Scoring API), GCS buckets, Secret Manager secrets, Artifact Registry repo,
least-privilege IAM service accounts, and (if `scoring_api_custom_domain`
is set) a Cloud Run domain mapping. DNS for custom domains is managed
externally (Cloudflare, per `variables.tf` comments) — not by Terraform.

Production domain: `sportzicon.com` (web), `api.sportzicon.com` (main API),
`scoring-api.sportzicon.com` (scoring API).

Health checks: `GET /internal/livez` on both API services, polled up to 15×
every 5s (75s total) after each production deploy.

### Migration failure handling (built into `deploy-production.yml`)

The `migrate-main-db` job doesn't just run `prisma migrate deploy` — it
inspects the failure and self-heals for known-safe cases before giving up:

| Prisma error | Meaning | Automatic response |
|---|---|---|
| `P1002` + "advisory lock" | Stale advisory lock from an interrupted prior migration | Runs `scripts/clear-stale-migration-lock.ts`, retries once |
| `P1001` / `P1002` / `P1003` (other) | Database unreachable | Skips migrations for this run, assumes schema is current, does **not** fail the deploy — Cloud Run's own `prisma migrate deploy && node dist/server.js` boot command is the real gate |
| `P3005` | Database has no migration history (fresh DB) | Baselines by resolving the latest migration as applied, then retries deploy |
| `P3018` / `P3009` | A migration is marked failed in the DB | Rolls back the failed migration via `prisma migrate resolve --rolled-back`, retries deploy |
| Anything else | — | Fails the job |

If you ever see a deploy where the DB-migration job logs a warning emoji and
still goes green, that's this self-healing logic — check the job log for
which branch it took before assuming migrations are actually up to date.

### A past incident worth knowing about

The `sed` commands that patch `api_image` / `web_image` / `scoring_api_image`
into `terraform.tfvars.prod.example` use `^api_image[[:space:]]*=` (tolerant
of column-alignment padding), not the more obvious `^api_image\s*=` or
`^api_image =`. That's not decorative — a stricter pattern was tried first,
silently no-op'd on the hand-aligned padded lines in that file, and staging's
`scoring-api` stopped receiving new images for a stretch despite CI staying
green (no error was raised, the `sed` just matched nothing). If you ever
reformat `terraform.tfvars.prod.example`'s alignment, re-verify these `sed`
lines still match. The Terraform import step for the scoring Cloud Run
service has the same class of bug fixed nearby: it checks
`terraform state show ... >/dev/null 2>&1` explicitly instead of `|| true`,
because `|| true` was masking real import failures the same way.

---

## 11. Testing

```bash
make test                                              # backend + frontend
cd backend && npm test -- --testPathPattern="auth"     # single test file
cd frontend && npm test                                 # Vitest
cd e2e && npx playwright test tests/sportivox/landing.spec.ts
```

Backend integration tests require `DATABASE_URL` to contain `localhost` or
`test` — they refuse to run against the cloud Supabase URL as a safety guard
(`backend/tests/helpers/setup.ts`).

---

## 12. Security Summary

Full checklist and rationale: [`SECURITY_RULES.md`](SECURITY_RULES.md).

| Control | Implementation |
|---|---|
| Passwords | bcrypt, 12 rounds, never logged |
| Access tokens | JWT, 15-min lifetime |
| Refresh tokens | 30-day, single-use, server-revocable, httpOnly cookie |
| Transport | HTTPS-only (Cloud Run) |
| Headers | Helmet.js (HSTS, X-Frame-Options, CSP enabled) |
| CORS | Origin allowlist, no wildcards |
| Rate limiting | Global + stricter on `/auth/*`, plus a dedicated limiter for link-preview fetches |
| Validation | Zod on every endpoint (body/query/params) |
| RBAC | Role in JWT, `requireRole` middleware, **admin bypasses every role check** everywhere by design (see `CLAUDE.md` Master Rule #1) |
| Private docs | GCS signed URLs, 15-min TTL |
| Audit trail | All admin actions → `AuditLog` table |

`/admin/*`, `/verification/*`, `/email-logs`, and `GET /admin/audit-log` are
admin-only and must stay that way — do not add other roles to these.

---

## 13. Onboarding Checklist — First Week

For a new engineer joining the project.

**Day 1 — access & orientation**
- [ ] Get GCP IAM access, GitHub repo access, Supabase project access, Resend dashboard access (see [§16](#16-what-the-new-owner-needs-to-take-over) for the full list)
- [ ] Clone the repo, read [`CLAUDE.md`](CLAUDE.md) Master Rules in full — these override default behavior for every task, including AI-assisted ones
- [ ] `make install && make dev`, confirm http://localhost:5173 loads
- [ ] Log in with each demo account ([§7](#7-running-it-locally)) and click through the role-specific nav to build a mental model of what each role sees

**Day 2–3 — read the code, don't just skim it**
- [ ] Trace one full request end to end: pick `applications` — read `applications.routes.ts` → `applications.service.ts` → `workflows/applicationWorkflow.ts`, then the matching frontend `useApplications.ts` → `application.service.ts` → the page that calls it
- [ ] Open `database/prisma/schema.prisma`, then `cd backend && npx prisma studio` to see the real data shape
- [ ] Run `cd backend && npm run typecheck` and `cd frontend && npm run typecheck && npm run build` once, clean, so you know what "passing" looks like before you change anything

**Day 3–5 — first change**
- [ ] Pick a small, bounded task (a bug fix or a single new field is ideal for a first PR)
- [ ] Follow the layer contract exactly: frontend `pages/ → hooks/ → services/ → api client`, backend `routes → service → schema`, never skip a layer (Master Rule #5)
- [ ] Before writing any endpoint, check `SECURITY_RULES.md` against it
- [ ] Run both typecheck+build commands from Master Rule #3 before calling anything done
- [ ] Match the commit style in [§17](#17-where-to-go-next) → `README.md#commit-style`

**Ongoing**
- [ ] Never write `requireRole("x")` without including `"admin"` — use `ROLES.*` from `backend/src/utils/roles.ts` instead of a raw string
- [ ] Never write `user.role === "x"` in JSX — use `hasRole()` from `frontend/src/utils/roles.ts`
- [ ] Schema changes always go through `prisma migrate dev --name ...`, never hand-edited into the generated copies

---

## 14. Troubleshooting / Runbook

| Symptom | Cause | Fix |
|---|---|---|
| Scoring console login fails / SSO handshake rejected | `MAIN_JWT_SECRET` in `scoring/backend/.env` doesn't match `JWT_ACCESS_SECRET` in `backend/.env` | Make them identical — this is the single most common cause of scoring auth breaking after a secret rotation |
| No emails arriving, but no errors either | `RESEND_API_KEY` is blank | Expected — the app runs in stub mode, emails are written to the `EmailLog` table (visible in `/email-logs` as admin) instead of sent. Set the key to send for real |
| App feels the same with or without Redis | Working as designed | `REDIS_URL` unset → all `cacheGet`/`cacheSet`/`cacheDel` calls are no-ops. There is no code path that requires Redis |
| Local `docker compose up` can't reach the database | `docker-compose.yml` does not start Postgres — production uses Supabase | Point `DATABASE_URL`/`DIRECT_URL` at a local Postgres container you start yourself, or a dev Supabase project |
| Backend integration tests refuse to run | Safety guard in `backend/tests/helpers/setup.ts` | Tests require `DATABASE_URL` to contain `localhost` or `test` — they will not run against the cloud Supabase URL, on purpose. Point at a local/test DB |
| `prisma migrate deploy` fails with `P1002` "advisory lock" | Stale lock from an interrupted prior migration | See [§10](#10-deployment--cicd) — the production pipeline self-heals this automatically; locally, run `npx tsx scripts/clear-stale-migration-lock.ts` then retry |
| `prisma migrate deploy` fails with `P3005` | Fresh database with no migration history | Baseline: `npx prisma migrate resolve --applied <latest-migration-name>`, then `migrate deploy` again |
| Staging deploy is green but the running service doesn't change | Possible silent `sed`/`|| true` no-op in the deploy workflow | See the incident note in [§10](#10-deployment--cicd) — verify the image tag actually landed in `terraform.tfvars.prod`/`.staging` before assuming the deploy took effect |
| Scoring backend schema changes not reflected | Forgot to regenerate | `cd scoring/backend && npm run db:generate` after any change to `database/prisma/schema.prisma` — it's a generated copy, not a live symlink |
| A new event's notification never appears | Event emitted but no handler registered | Check `notificationHandler.ts` — unlike most events, `org.verified`/`org.verification_rejected`/`application.status_changed` don't go through it (see [§6](#6-event-driven-architecture--state-machines)); confirm your new event is actually wired if you expect the same pattern |
| GCS uploads fail locally | `fake-gcs-server` container not reachable | Confirm the `gcs` service in `docker-compose.yml` is up on `:4443` and `STORAGE_EMULATOR_HOST` points at it |

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Content** | The unified model backing posts, reels, and blogs — one `Content` table distinguished by a `content_type` field, not three separate tables/modules |
| **Opportunity** | A trial, recruitment listing, scholarship, tournament, or coaching job posted by a club/organizer, with a vacancy count and application deadline |
| **Application** | An athlete's submission against an Opportunity; moves through the state machine in [§6](#6-event-driven-architecture--state-machines) |
| **Vacancy** | Remaining open slots on an Opportunity; an Opportunity auto-transitions to `filled`/`closed` when vacancies hit zero or the deadline passes |
| **EventBus** | The in-process fire-and-forget pub/sub singleton (`lib/EventBus.ts`) that decouples "thing happened" from "notify someone" |
| **StateMachine** | The generic FSM class (`lib/StateMachine.ts`) backing both the application and opportunity workflows — never hand-roll transition logic outside it |
| **Guardian consent** | A minor athlete's signup requires a guardian to confirm via emailed link, or an admin to approve manually, before the account is fully active |
| **Verification (badge)** | Admin-reviewed document check that marks a user or organization as verified — distinct from email verification |
| **SSO (scoring)** | The scoring subsystem trusts the main app's access token during a token-exchange handshake, governed by `MAIN_JWT_SECRET` matching the main backend's `JWT_ACCESS_SECRET`, then issues its own scoring-scoped JWT |
| **Signed URL** | A time-limited (15 min) GCS URL used for both uploads (PUT) and private-document downloads (GET), so the backend never proxies file bytes |
| **Cursor pagination** | The pagination style used across search, reels, opportunities, notifications, feed, comments, and blogs — `nextCursor` + overfetch-by-one (`take: limit + 1`), no offset pagination anywhere |
| **safeUserSelect** | The canonical Prisma `select` object (`backend/src/utils/user.ts`) used on every auth/user response so `password_hash` and tokens are never accidentally returned |
| **multiSchema** | The Prisma feature letting one `schema.prisma` define models across two Postgres schemas (`public`, `scoring`) in a single physical database |
| **Master Rules** | The numbered rules at the top of `CLAUDE.md` that govern every code change in this repo, including AI-assisted ones — admin override, layer architecture, mobile-first, etc. |

---

## 16. What the New Owner Needs to Take Over

Access/credentials to transfer or re-provision:

- **GCP project** — IAM ownership/billing transfer, or new project + re-run Terraform
- **Supabase project** — database ownership, connection strings
- **Domain registrar / DNS** (Cloudflare per Terraform comments) — `sportzicon.com`
- **GitHub repository** — admin access, repo secrets listed in [§10](#10-deployment--cicd), environment approvers for `production-approval`
- **Resend account** — email sending API key
- **Artifact Registry / Cloud Build** — inherited with GCP project

---

## 17. Where to Go Next

| Need | Location |
|---|---|
| Full command reference (dev, test, build, lint, seed, migrate) | [`README.md`](README.md) |
| Coding rules / architecture contracts for future dev work | [`CLAUDE.md`](CLAUDE.md) |
| Security checklist | [`SECURITY_RULES.md`](SECURITY_RULES.md) |
| Deep architecture notes | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Scaling analysis / capacity planning | [`docs/SCALING_PLAN.md`](docs/SCALING_PLAN.md), [`docs/scaling-architecture-analysis.md`](docs/scaling-architecture-analysis.md) |
| Release history | [`CHANGELOG.md`](CHANGELOG.md) |
