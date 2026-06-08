# Architecture Diagrams — Sportivox / Sportzicon

**Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Current  

This document is a standalone reference for all architecture diagrams. Each diagram is self-contained and cross-referenced to the detailed design documents.

---

## Table of Contents

1. [Full System Topology](#1-full-system-topology)
2. [Frontend Data Flow](#2-frontend-data-flow)
3. [Backend Request Lifecycle](#3-backend-request-lifecycle)
4. [Event Bus Flow](#4-event-bus-flow)
5. [Application Workflow](#5-application-workflow)
6. [Database Schema Relationship Map](#6-database-schema-relationship-map)
7. [Scoring Subsystem Integration](#7-scoring-subsystem-integration)
8. [CI/CD Pipeline](#8-cicd-pipeline)

---

## 1. Full System Topology

This diagram shows every service, database, and external dependency in the production environment and how they connect.

```
═══════════════════════════════════════════════════════════════════════════════════════
                          SPORTIVOX FULL SYSTEM TOPOLOGY
═══════════════════════════════════════════════════════════════════════════════════════

  ┌────────────────────────────────────────────────────────────────────────────────┐
  │  CLIENT DEVICES                                                                │
  │                                                                                │
  │  ┌──────────────────┐         ┌──────────────────┐                            │
  │  │  Browser (Main)  │         │ Browser (Scoring) │                            │
  │  │  React SPA       │         │ Scoring React SPA │                            │
  │  └────────┬─────────┘         └────────┬──────────┘                           │
  └───────────┼───────────────────────────┼────────────────────────────────────────┘
              │ HTTPS                     │ HTTPS
              │                           │
  ┌───────────▼───────────────────────────▼────────────────────────────────────────┐
  │  GCP CLOUD RUN                                                                 │
  │                                                                                │
  │  ┌──────────────────────────────────────────────────────────────────────────┐  │
  │  │  INGRESS / LOAD BALANCER (GCP Cloud Run Ingress)                        │  │
  │  └──────────────────┬───────────────────────────────────┬───────────────────┘  │
  │                     │                                   │                       │
  │                     │ /api/*                            │ /scoring-api/*         │
  │                     │ (main app routes)                 │ (Vite proxy in dev)   │
  │                     │                                   │                       │
  │  ┌──────────────────▼──────────────────┐  ┌────────────▼──────────────────┐   │
  │  │  MAIN BACKEND                       │  │  SCORING BACKEND              │   │
  │  │  Node.js 20 + Express 4 + TypeScript│  │  Node.js + Express + TypeScript│   │
  │  │  Port: 8080                         │  │  Port: 4000                   │   │
  │  │                                     │  │                               │   │
  │  │  Modules (16):                      │  │  Modules:                     │   │
  │  │  auth, users, organizations,        │  │  auth (SSO)                   │   │
  │  │  opportunities, applications,       │  │  matches                      │   │
  │  │  posts, reels, blogs, follow,       │  │  innings                      │   │
  │  │  messaging, notifications,          │  │  balls                        │   │
  │  │  search, media, ai,                 │  │  scorecards                   │   │
  │  │  verification, admin, email-logs    │  │  players                      │   │
  │  │                                     │  │                               │   │
  │  │  Prisma ORM → Supabase PostgreSQL   │  │  Prisma ORM → Cloud SQL PG    │   │
  │  └──────┬─────────────────────────┬────┘  └───────────────┬───────────────┘   │
  │         │                         │                       │                    │
  └─────────┼─────────────────────────┼───────────────────────┼────────────────────┘
            │                         │                       │
            │                         │                       │
  ┌─────────▼──────────┐  ┌───────────▼──────────────┐  ┌────▼────────────────────┐
  │  SUPABASE          │  │  GOOGLE CLOUD STORAGE    │  │  SCORING POSTGRESQL     │
  │  PostgreSQL        │  │                          │  │  (GCP Cloud SQL or      │
  │  (Main Database)   │  │  ┌────────────────────┐  │  │   Docker locally)       │
  │                    │  │  │ sportivox-media    │  │  │                         │
  │  All app data:     │  │  │ (public bucket)    │  │  │  Match data:            │
  │  users, orgs,      │  │  │ profile photos,    │  │  │  matches, innings,      │
  │  opportunities,    │  │  │ post images,       │  │  │  balls, scorecards,     │
  │  applications,     │  │  │ reel thumbnails    │  │  │  player references      │
  │  posts, reels,     │  │  └────────────────────┘  │  │                         │
  │  blogs, messages,  │  │                          │  │  (No FK to main DB —    │
  │  notifications,    │  │  ┌────────────────────┐  │  │  only user ID strings)  │
  │  audit logs, etc.  │  │  │ sportivox-docs     │  │  │                         │
  │                    │  │  │ (private bucket)   │  │  └─────────────────────────┘
  │  Connection via    │  │  │ org documents,     │  │
  │  PgBouncer pool    │  │  │ verification files │  │
  └────────────────────┘  │  └────────────────────┘  │
                          └──────────────────────────┘
            │
            │  (Main backend also calls)
            │
  ┌─────────┴─────────────────────────────────────────────────────────────────────┐
  │  EXTERNAL SERVICES                                                            │
  │                                                                               │
  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐   │
  │  │  OpenAI          │  │  Gmail / Resend   │  │  GitHub Actions           │   │
  │  │  GPT-4o-mini     │  │  (Email)          │  │  (CI/CD)                  │   │
  │  │                  │  │                   │  │                           │   │
  │  │  Called by:      │  │  Called by:       │  │  → Build Docker images    │   │
  │  │  ai module       │  │  email module     │  │  → Push Artifact Registry │   │
  │  │  (athlete tips)  │  │  (verify, reset,  │  │  → prisma migrate deploy  │   │
  │  │                  │  │  app status)      │  │  → Deploy Cloud Run       │   │
  │  └──────────────────┘  └──────────────────┘  └───────────────────────────┘   │
  └───────────────────────────────────────────────────────────────────────────────┘

Legend:
  ───► HTTP/HTTPS call
  ════ Managed cloud service boundary
```

---

## 2. Frontend Data Flow

This diagram traces the path of data from a user action all the way to the API response and back to the rendered UI.

```
═══════════════════════════════════════════════════════════════════════════════════════
                     FRONTEND DATA FLOW (TanStack Query pattern)
═══════════════════════════════════════════════════════════════════════════════════════

  USER ACTION (click, form submit, navigation)
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  REACT COMPONENT                                                            │
  │  e.g. <OpportunitiesPage />, <ApplicationCard />, <CreatePostForm />        │
  │                                                                             │
  │  ┌──────────────────┐    ┌─────────────────────────────────────────────┐   │
  │  │  Local UI State  │    │  Props / Context                            │   │
  │  │  useState(modal) │    │  (layout, role-specific config)             │   │
  │  └──────────────────┘    └─────────────────────────────────────────────┘   │
  └──────────────────────────────────┬──────────────────────────────────────────┘
                                     │ call hook
                                     ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  CUSTOM HOOK (frontend/src/hooks/)                                           │
  │  e.g. useOpportunities(), useApplications(), useFeed()                       │
  │                                                                              │
  │  For reads:                          For mutations:                          │
  │  useQuery({                          useMutation({                           │
  │    queryKey: queryKeys.opps.list(),    mutationFn: service.apply,            │
  │    queryFn: service.getOpps,           onSuccess: () => {                    │
  │    staleTime: 30_000,                    queryClient.invalidateQueries(       │
  │  })                                        queryKeys.applications.all())     │
  │                                        }                                     │
  │                                      })                                      │
  └──────────────────────────────────────────────────────────────────────────────┘
                                     │ call service fn
                                     ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  SERVICE FUNCTION (frontend/src/services/)                                   │
  │  e.g. opportunityService.ts, applicationService.ts                           │
  │                                                                              │
  │  export const getOpportunities = async (filters) => {                        │
  │    const res = await api.get('/opportunities', { params: filters });         │
  │    return res.data;                                                          │
  │  }                                                                           │
  │                                                                              │
  │  (No business logic here — pure HTTP translation)                            │
  └──────────────────────────────────────────────────────────────────────────────┘
                                     │ axios call
                                     ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  HTTP CLIENT (frontend/src/lib/api.ts)                                       │
  │                                                                              │
  │  axios instance with:                                                        │
  │  • baseURL = VITE_API_BASE_URL                                               │
  │  • request interceptor → inject Authorization: Bearer <accessToken>          │
  │  • response interceptor → on 401:                                            │
  │       1. call POST /auth/refresh                                             │
  │       2. update Zustand authStore with new tokens                            │
  │       3. retry original request                                              │
  │       4. on refresh failure → authStore.clear() → redirect /login           │
  └──────────────────────────────────────────────────────────────────────────────┘
                                     │ HTTPS
                                     ▼
                              BACKEND REST API
                                     │
                                     │ JSON response
                                     ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  TANSTACK QUERY CACHE                                                        │
  │                                                                              │
  │  • Caches response by queryKey                                               │
  │  • Background refetch on stale (staleTime configurable per hook)             │
  │  • Provides { data, isLoading, isError } to component                        │
  │  • Invalidation on mutation success triggers fresh fetch                     │
  └──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
                         COMPONENT RE-RENDERS WITH DATA
```

---

## 3. Backend Request Lifecycle

This diagram traces a single HTTP request from arrival to response through all middleware layers.

```
═══════════════════════════════════════════════════════════════════════════════════════
                     BACKEND REQUEST LIFECYCLE
═══════════════════════════════════════════════════════════════════════════════════════

  Incoming HTTP Request
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [1] helmet()                                                               │
  │  Sets security headers:                                                     │
  │  Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,          │
  │  Strict-Transport-Security, X-XSS-Protection                                │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [2] cors()                                                                 │
  │  Allow-Origin: FRONTEND_ORIGIN env var                                      │
  │  Allow-Methods: GET, POST, PUT, PATCH, DELETE                               │
  │  OPTIONS preflight → 204                                                    │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [3] express-rate-limit (global)                                            │
  │  Tighter limits on /auth/* routes                                           │
  │  429 → Too Many Requests if exceeded                                        │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [4] pino-http (request logger)                                             │
  │  Logs method, path, status, response time as JSON                           │
  │  Redacts: Authorization header, password fields in body                     │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [5] express.json()                                                         │
  │  Parse JSON request body                                                    │
  │  413 → Payload Too Large if body exceeds limit                              │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [6] authMiddleware (on protected routes)                                   │
  │  Extract Bearer token from Authorization header                             │
  │  jwt.verify(token, JWT_SECRET)                                              │
  │  401 → if missing, malformed, or expired                                    │
  │  req.user = { id, role, email }                                             │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [7] roleGuard(allowedRoles[]) (on role-restricted routes)                  │
  │  Check req.user.role ∈ allowedRoles                                         │
  │  403 → if role not permitted                                                │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [8] Zod Request Validation (in route handler)                              │
  │  schema.parse(req.body) or schema.parse(req.query)                          │
  │  400 → ZodError with field-level messages                                   │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [9] SERVICE METHOD                                                         │
  │  Business logic, orchestration                                              │
  │  Calls repository / prisma                                                  │
  │  May emit EventBus events                                                   │
  │  Throws AppError on business rule violation                                 │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [10] REPOSITORY / PRISMA CLIENT                                            │
  │  Executes SQL via Prisma                                                    │
  │  Returns typed entity objects                                               │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [11] RESPONSE                                                              │
  │  res.status(200).json({ data })                                             │
  │  Pino-http logs final status + duration                                     │
  └──────────────────────────────────────┬──────────────────────────────────────┘
                                         │
                                         ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │  [12] GLOBAL ERROR HANDLER (if any step threw)                              │
  │  backend/src/middleware/errorHandler.ts                                     │
  │  AppError → { status, code, message }                                       │
  │  Prisma P2002 (unique) → 409 Conflict                                       │
  │  Prisma P2025 (not found) → 404 Not Found                                   │
  │  Unhandled → 500 Internal Server Error (message redacted in production)     │
  └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Event Bus Flow

The EventBus singleton decouples primary business transactions from secondary side effects (notifications, email).

```
═══════════════════════════════════════════════════════════════════════════════════════
                           EVENT BUS FLOW
═══════════════════════════════════════════════════════════════════════════════════════

  backend/src/lib/eventBus.ts  (singleton EventEmitter)

  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  EMITTERS (Service Layer)                                                        │
  └──────────────────────────────────────────────────────────────────────────────────┘

  ApplicationService                 FollowService
  ├── emit('application.submitted')  └── emit('user.followed')
  └── emit('application.status_changed')
                                     PostService
  VerificationService                └── emit('post.liked')
  └── emit('org.verified')
                                     MessagingService
                                     └── emit('message.sent')

  ─────────────────────────────────────────────────────────────────────────────────
                              EventBus (Node EventEmitter)
  ─────────────────────────────────────────────────────────────────────────────────

  ┌──────────────────────────────────────────────────────────────────────────────────┐
  │  HANDLERS (Subscribed at app startup)                                            │
  └──────────────────────────────────────────────────────────────────────────────────┘

  Event: 'application.submitted'
  └── NotificationHandler.onApplicationSubmitted(event)
      └── prisma.notification.create({
            userId: opportunity.org.owner_user_id,
            type: 'NEW_APPLICATION',
            actorId: applicant.id,
          })

  Event: 'application.status_changed'
  ├── NotificationHandler.onApplicationStatusChanged(event)
  │   └── prisma.notification.create({
  │         userId: application.applicant_user_id,
  │         type: 'APPLICATION_STATUS',
  │         payload: { from, to }
  │       })
  └── EmailHandler.onApplicationStatusChanged(event)
      └── emailService.send({
            to: applicant.email,
            template: 'application-status',
            vars: { name, status, oppTitle }
          })

  Event: 'user.followed'
  └── NotificationHandler.onUserFollowed(event)
      └── prisma.notification.create({
            userId: followedUserId,
            type: 'NEW_FOLLOWER',
            actorId: followerUserId,
          })

  Event: 'org.verified'
  ├── NotificationHandler.onOrgVerified(event)
  │   └── prisma.notification.create({
  │         userId: org.owner_user_id,
  │         type: 'ORG_VERIFIED',
  │       })
  └── EmailHandler.onOrgVerified(event)
      └── emailService.send({
            to: orgOwner.email,
            template: 'org-verified',
          })

  Event: 'post.liked'
  └── NotificationHandler.onPostLiked(event)
      └── prisma.notification.create({
            userId: post.author_id,
            type: 'POST_LIKED',
            actorId: liker.id,
          })

  Event: 'message.sent'
  └── NotificationHandler.onMessageSent(event)
      └── update Conversation.unread_counts for recipient
          (increment JSON field for recipientId)

  Note: All handlers are fire-and-forget. Failures are logged but do not roll
  back the primary transaction. This is a known trade-off — no retry queue exists.
```

---

## 5. Application Workflow

Full state machine for the `Application` entity showing all states, legal transitions, actor guards, and side effects.

```
═══════════════════════════════════════════════════════════════════════════════════════
                        APPLICATION WORKFLOW STATE MACHINE
═══════════════════════════════════════════════════════════════════════════════════════

                           ┌───────────────────────────────────┐
                           │         [ENTRY POINT]             │
                           │  Athlete submits via              │
                           │  POST /api/applications           │
                           │  Guard: opp.status = 'open'       │
                           │  Guard: no existing application   │
                           │  Side: opp.application_count++    │
                           │  Side: emit application.submitted │
                           └──────────────────┬────────────────┘
                                              │
                                              ▼
                                   ┌──────────────────┐
                                   │                  │
                                   │    PENDING       │
                                   │                  │
                                   └──────┬───────────┘
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    │                     │                      │
         [club: PATCH /shortlist]  [club: PATCH /reject]  [athlete: PATCH /withdraw]
         Guard: opp.status=open    Guard: none            Guard: none
         Side: emit status_changed Side: emit status_chg  Side: emit status_chg
                    │                     │                      │
                    ▼                     ▼                      ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌─────────────────────┐
         │                  │   │                  │   │                     │
         │  SHORTLISTED     │   │    REJECTED      │   │    WITHDRAWN        │
         │                  │   │                  │   │                     │
         └────────┬─────────┘   │  (TERMINAL)      │   │   (TERMINAL)        │
                  │             └──────────────────┘   └─────────────────────┘
                  │
      ┌───────────┴─────────────┐
      │                         │
 [club: PATCH /select]    [club: PATCH /reject]
 Guard: opp.vacancies     Guard: none
   not yet filled         Side: emit status_chg
 Side: opp filled_count++
 Side: if filled_count >=
   vacancies →
   opp.status = 'filled'
 Side: emit status_chg
      │                         │
      ▼                         ▼
 ┌──────────────┐       ┌──────────────────┐
 │              │       │                  │
 │   SELECTED   │       │    REJECTED      │
 │              │       │                  │
 │  (TERMINAL)  │       │  (TERMINAL)      │
 └──────────────┘       └──────────────────┘

History: every transition appends to Application.history JSON array
  { from, to, by (userId), at (ISO timestamp), note? }

Notification: every transition emits application.status_changed
  → NotificationHandler creates Notification for applicant
  → EmailHandler sends status email to applicant
```

---

## 6. Database Schema Relationship Map

Entity-relationship map showing all entities and foreign key relationships.

```
═══════════════════════════════════════════════════════════════════════════════════════
                    DATABASE SCHEMA RELATIONSHIP MAP
═══════════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │  database/prisma/schema.prisma                                                  │
  └─────────────────────────────────────────────────────────────────────────────────┘

                               ┌──────────────────────┐
                               │        USER          │
                               │─────────────────────│
                               │ id (PK)              │
                               │ email (unique)       │
                               │ passwordHash         │
                               │ role                 │◄─────────────────┐
                               │ status               │                  │
                               │ athlete_data (JSON)  │                  │
                               │ coach_data (JSON)    │                  │
                               │ follower_count       │                  │
                               │ following_count      │                  │
                               └──┬───────────────────┘                  │
                                  │                                      │
           ┌──────────────────────┼──────────────────────────────────────┤
           │                      │                                      │
           │ owner_user_id        │ author_id (Post/Reel/Blog)           │ actor/user_id
           ▼                      │                                      │
  ┌────────────────────┐          │                          ┌───────────────────────┐
  │   ORGANIZATION     │          │                          │    NOTIFICATION        │
  │────────────────────│          │                          │────────────────────────│
  │ id (PK)            │          │                          │ id (PK)               │
  │ owner_user_id (FK) │          │                          │ user_id (FK)          │
  │ org_name           │          │                          │ actor_id (FK)         │
  │ org_type           │          │                          │ type                  │
  │ sport_categories[] │          │                          │ read                  │
  │ verification       │          │                          │ payload (JSON)        │
  └────────┬───────────┘          │                          └───────────────────────┘
           │                      │
           │ org_id               │                          ┌───────────────────────┐
           ▼                      │                          │      FOLLOW            │
  ┌────────────────────┐          │                          │────────────────────────│
  │   OPPORTUNITY      │          │                          │ follower_id (FK→User) │
  │────────────────────│          │                          │ following_id (FK→User)│
  │ id (PK)            │          │                          │ (composite PK)        │
  │ org_id (FK)        │          │                          └───────────────────────┘
  │ type               │          │
  │ sport              │          │                          ┌───────────────────────┐
  │ status             │          │                          │   REFRESH_TOKEN        │
  │ application_count  │          │                          │────────────────────────│
  │ vacancies          │          │                          │ id (PK)               │
  │ application_       │          │                          │ token (unique)        │
  │   deadline         │          │                          │ user_id (FK)          │
  └────────┬───────────┘          │                          │ revoked               │
           │                      │                          │ expires_at            │
           │ opportunity_id       │                          └───────────────────────┘
           ▼                      ▼
  ┌────────────────────┐   ┌─────────────────────┐          ┌───────────────────────┐
  │   APPLICATION      │   │  POST / REEL / BLOG  │          │  EMAIL_VERIFICATION    │
  │────────────────────│   │─────────────────────│          │────────────────────────│
  │ id (PK)            │   │ id (PK)              │          │ id (PK)               │
  │ opportunity_id(FK) │   │ author_id (FK→User)  │          │ user_id (FK)          │
  │ applicant_user_(FK)│   │ like_count           │          │ token                 │
  │ status             │   │ comment_count        │          │ expires_at            │
  │ history (JSON[])   │   │ view_count           │          └───────────────────────┘
  └────────────────────┘   │ content fields       │
                           └──────────┬───────────┘          ┌───────────────────────┐
                                      │                       │  PASSWORD_RESET        │
                                      │ post_id/reel_id/      │────────────────────────│
                                      │   blog_id             │ id (PK)               │
                                      ▼                       │ user_id (FK)          │
                           ┌──────────────────────┐          │ token                 │
                           │     COMMENT          │          │ expires_at            │
                           │──────────────────────│          └───────────────────────┘
                           │ id (PK)              │
                           │ author_id (FK→User)  │          ┌───────────────────────┐
                           │ parent_type          │          │   POST_LIKE            │
                           │   (post/reel/blog)   │          │  REEL_LIKE             │
                           │ post_id? (FK→Post)   │          │  BLOG_LIKE             │
                           │ reel_id? (FK→Reel)   │          │────────────────────────│
                           │ blog_id? (FK→Blog)   │          │ post_id / reel_id /   │
                           └──────────────────────┘          │   blog_id (FK)        │
                                                             │ user_id (FK)          │
                                                             │ (composite PK)        │
                                                             └───────────────────────┘

  ┌──────────────────────┐      ┌──────────────────────────────────┐
  │   CONVERSATION       │      │         MESSAGE                  │
  │──────────────────────│      │──────────────────────────────────│
  │ id (PK)              │      │ id (PK)                          │
  │ participant_ids []   │◄─────│ conversation_id (FK→Convo)      │
  │   (String array)     │      │ sender_id (FK→User)              │
  │ last_message (JSON)  │      │ recipient_id (FK→User)           │
  │ unread_counts (JSON) │      │ body                             │
  └──────────────────────┘      │ read                             │
                                └──────────────────────────────────┘

  ┌──────────────────────┐      ┌──────────────────────────────────┐
  │   AUDIT_LOG          │      │         REPORT                   │
  │──────────────────────│      │──────────────────────────────────│
  │ id (PK)              │      │ id (PK)                          │
  │ actor_id (FK→User)   │      │ reporter_id (FK→User)            │
  │ action               │      │ target_type (post/reel/user)     │
  │ target_type          │      │ target_id                        │
  │ target_id            │      │ reason                           │
  │ metadata (JSON)      │      │ status (pending/resolved)        │
  │ created_at           │      └──────────────────────────────────┘
  └──────────────────────┘

  ┌──────────────────────┐      ┌──────────────────────────────────┐
  │  VERIFICATION        │      │         EMAIL_LOG                │
  │──────────────────────│      │──────────────────────────────────│
  │ id (PK)              │      │ id (PK)                          │
  │ org_id (FK→Org)      │      │ user_id (FK→User)                │
  │ status               │      │ template                         │
  │ reviewed_by (FK→User)│      │ to_address                       │
  │ documents []         │      │ status (sent/failed)             │
  │ notes                │      │ provider_id                      │
  └──────────────────────┘      │ sent_at                          │
                                └──────────────────────────────────┘
```

---

## 7. Scoring Subsystem Integration

```
═══════════════════════════════════════════════════════════════════════════════════════
                     SCORING SUBSYSTEM INTEGRATION DIAGRAM
═══════════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────────────────┐
  │  MAIN APPLICATION                    │  SCORING SUBSYSTEM                       │
  │                                      │                                          │
  │  ┌──────────────────────────────┐    │   ┌──────────────────────────────────┐  │
  │  │  Main React SPA              │    │   │  Scoring React SPA               │  │
  │  │  (port 5173 in dev)          │    │   │  (separate Vite app)             │  │
  │  │                              │    │   │                                  │  │
  │  │  1. User navigates to        │    │   │  3. SPA uses scoringToken for    │  │
  │  │     scoring section          │    │   │     all API calls                │  │
  │  │                              │    │   │                                  │  │
  │  │  2. POST /scoring-api/       │────────►│  SSO endpoint validates         │  │
  │  │     api/auth/sso             │    │   │  mainJWT, issues scoringJWT      │  │
  │  │     Body: {mainJWT}          │◄───────┤  Response: {scoringToken}        │  │
  │  │                              │    │   │                                  │  │
  │  │  Vite proxy:                 │    │   │                                  │  │
  │  │  /scoring-api → :4000        │    │   │                                  │  │
  │  └──────────────────────────────┘    │   └──────────────────────────────────┘  │
  │                                      │                     │                    │
  │  ┌──────────────────────────────┐    │   ┌────────────────▼─────────────────┐  │
  │  │  Main Backend                │    │   │  Scoring Backend                 │  │
  │  │  (port 8080)                 │    │   │  (port 4000)                     │  │
  │  │                              │    │   │                                  │  │
  │  │  Issues mainJWT containing:  │    │   │  Validates mainJWT (or scoring   │  │
  │  │  { id, role, email }         │    │   │  JWT) using SHARED_JWT_SECRET    │  │
  │  │                              │    │   │                                  │  │
  │  │  Does NOT know about         │    │   │  Issues scoringJWT:              │  │
  │  │  scoring data                │    │   │  { userId, scope: 'scoring' }    │  │
  │  │                              │    │   │                                  │  │
  │  └──────────────────────────────┘    │   └──────────────────────────────────┘  │
  │                                      │                     │                    │
  │  ┌──────────────────────────────┐    │   ┌────────────────▼─────────────────┐  │
  │  │  Main PostgreSQL (Supabase)  │    │   │  Scoring PostgreSQL              │  │
  │  │                              │    │   │  (Docker local / Cloud SQL prod) │  │
  │  │  Users, Orgs, Opps, Apps,    │    │   │                                  │  │
  │  │  Posts, etc.                 │    │   │  matches, innings, balls,        │  │
  │  │                              │    │   │  scorecards, player_ids[]        │  │
  │  │  User.id is the shared       │    │   │                                  │  │
  │  │  identity anchor             │    │   │  player_id values reference      │  │
  │  │                              │    │   │  User.id from main DB but        │  │
  │  │                              │    │   │  NO FK constraint enforced       │  │
  │  └──────────────────────────────┘    │   └──────────────────────────────────┘  │
  │                                      │                                          │
  └──────────────────────────────────────┴──────────────────────────────────────────┘

  Data boundary:
  ─ Player identity: Main DB (User records)
  ─ Match/scoring data: Scoring DB (no join possible across DBs)
  ─ Auth shared via JWT exchange, NOT via shared DB session

  Integration gap (ARCH-009):
  ─ No API bridge exists to query a player's stats from the main app
  ─ No webhook/event from scoring → main on match completion
  ─ Player profile in main app cannot display scoring history
```

---

## 8. CI/CD Pipeline

```
═══════════════════════════════════════════════════════════════════════════════════════
                           CI/CD PIPELINE DIAGRAM
═══════════════════════════════════════════════════════════════════════════════════════

  Developer                GitHub                  GitHub Actions            GCP
     │                       │                           │                    │
     │── git push ──────────►│                           │                    │
     │   (feature branch)    │                           │                    │
     │                       │── trigger PR workflow ──►│                    │
     │                       │                           │                    │
     │                       │                    ┌──────────────────────┐   │
     │                       │                    │  PR WORKFLOW          │   │
     │                       │                    │  .github/workflows/  │   │
     │                       │                    │  pr.yml              │   │
     │                       │                    │                      │   │
     │                       │                    │  1. npm ci (all pkgs)│   │
     │                       │                    │  2. tsc --noEmit     │   │
     │                       │                    │     (backend +       │   │
     │                       │                    │      frontend)       │   │
     │                       │                    │  3. eslint           │   │
     │                       │                    │  4. npm test         │   │
     │                       │                    │  5. docker build     │   │
     │                       │                    │     (no push)        │   │
     │                       │                    └──────────────────────┘   │
     │                       │                           │                    │
     │── merge PR ──────────►│                           │                    │
     │   (to main)           │── trigger deploy ────────►│                    │
     │                       │   workflow                │                    │
     │                       │                    ┌──────────────────────┐   │
     │                       │                    │  DEPLOY WORKFLOW      │   │
     │                       │                    │  .github/workflows/  │   │
     │                       │                    │  deploy.yml          │   │
     │                       │                    │                      │   │
     │                       │                    │  1. docker build     │   │
     │                       │                    │     backend image    │   │
     │                       │                    │  2. docker build     │   │
     │                       │                    │     scoring image    │   │
     │                       │                    │  3. docker push ────────►│
     │                       │                    │     → Artifact       │   │ Artifact
     │                       │                    │       Registry       │   │ Registry
     │                       │                    │  4. prisma migrate   │   │
     │                       │                    │     deploy ─────────────►│
     │                       │                    │     (main DB)        │   │ Supabase
     │                       │                    │  5. gcloud run ──────────►│
     │                       │                    │     deploy           │   │ Cloud Run
     │                       │                    │     (main backend)   │   │ (main)
     │                       │                    │  6. gcloud run ──────────►│
     │                       │                    │     deploy           │   │ Cloud Run
     │                       │                    │     (scoring backend)│   │ (scoring)
     │                       │                    │  7. verify health    │   │
     │                       │                    │     check endpoint   │   │
     │                       │                    └──────────────────────┘   │
     │                                                                        │
     │                                                  Traffic split:        │
     │                                                  New revision gets 0%  │
     │                                                  tagged, smoke test,   │
     │                                                  then 100% migrated     │
     │                                                  (Cloud Run revisions)  │

  Environments:
  ┌────────────┬──────────────────────┬──────────────────────────┐
  │ Branch     │ Trigger              │ Target                   │
  ├────────────┼──────────────────────┼──────────────────────────┤
  │ PR         │ push (non-main)      │ Build + test only        │
  │ main       │ merge               │ Deploy to production GCP │
  └────────────┴──────────────────────┴──────────────────────────┘

  Infrastructure Changes:
  Developer
     │── modify infra/terraform/ ──►│ git push
     │                               │ (separate Terraform workflow or manual)
     │                               │── terraform plan ──────────────────────►│
     │                               │   (reviewed as PR comment)               │
     │                               │── terraform apply ─────────────────────►│
     │                               │   (on approval)                         │
```
