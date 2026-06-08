# Low-Level Design — Sportivox / Sportzicon

**Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Current  

---

## Table of Contents

1. [Frontend Layer Architecture](#1-frontend-layer-architecture)
2. [Backend Module Architecture](#2-backend-module-architecture)
3. [Complete API Surface](#3-complete-api-surface)
4. [Authentication and Authorisation Flow](#4-authentication-and-authorisation-flow)
5. [Application State Machine](#5-application-state-machine)
6. [Opportunity Lifecycle State Machine](#6-opportunity-lifecycle-state-machine)
7. [Scoring SSO Flow](#7-scoring-sso-flow)
8. [Media Upload Flow](#8-media-upload-flow)
9. [Database Entity Relationships](#9-database-entity-relationships)
10. [Key Sequence Diagrams](#10-key-sequence-diagrams)
11. [Frontend Component Hierarchy](#11-frontend-component-hierarchy)
12. [Service Layer Call Graph](#12-service-layer-call-graph)

---

## 1. Frontend Layer Architecture

The frontend is structured in four horizontal layers. Data flows downward from top (pages) to bottom (API), and responses propagate back upward.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PAGES (Route-level components)                       │
│  frontend/src/pages/                                            │
│  DashboardPage, OpportunitiesPage, ProfilePage, MessagesPage    │
│  ApplicationsPage, ScorePage, AdminPage, ...                    │
└───────────────────────┬─────────────────────────────────────────┘
                        │ uses
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 2 — CUSTOM HOOKS (server state + mutation wrappers)      │
│  frontend/src/hooks/                                            │
│  useOpportunities, useApplications, useProfile, useMessages     │
│  useFeed, useNotifications, useFollow, useSearch, useMedia      │
│  Each hook wraps a TanStack Query useQuery / useMutation        │
└───────────────────────┬─────────────────────────────────────────┘
                        │ calls
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 3 — SERVICE FUNCTIONS (API call wrappers)                │
│  frontend/src/services/                                         │
│  opportunityService.ts, applicationService.ts, userService.ts  │
│  messageService.ts, postService.ts, reelService.ts, blogService │
│  authService.ts, mediaService.ts, searchService.ts, aiService  │
│  Each function wraps an axios/fetch call with typed params/resp │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP
┌───────────────────────▼─────────────────────────────────────────┐
│  LAYER 4 — HTTP CLIENT                                          │
│  frontend/src/lib/api.ts (axios instance)                       │
│  Configured base URL, auth header injection, 401 interceptor    │
│  (intercepts 401, calls refresh, retries original request)      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 State Management

| State Type            | Tool                     | Location                          |
|-----------------------|--------------------------|-----------------------------------|
| Server state          | TanStack React Query v5  | Hooks layer (useQuery, useMutation)|
| Auth session          | Zustand                  | `frontend/src/store/authStore.ts` |
| UI state (modals etc) | Zustand or local useState| Component level                   |
| Form state            | react-hook-form + Zod    | Page/Form component level         |

### 1.2 Query Key Factory Pattern

All TanStack Query cache keys are defined in a central factory to prevent key collisions and enable targeted cache invalidation:

```typescript
// frontend/src/lib/queryKeys.ts
export const queryKeys = {
  opportunities: {
    all:    () => ['opportunities'] as const,
    list:   (filters) => ['opportunities', 'list', filters] as const,
    detail: (id)      => ['opportunities', id] as const,
  },
  applications: {
    all:    () => ['applications'] as const,
    byUser: (userId)  => ['applications', 'user', userId] as const,
    detail: (id)      => ['applications', id] as const,
  },
  // ... all 16 modules follow this pattern
}
```

### 1.3 Route Protection

Routes are wrapped in `<ProtectedRoute>` components that read from the Zustand auth store and redirect to `/login` if the user is not authenticated. Role-specific routes additionally check `user.role` and redirect to a 403 page or the user's dashboard if the role does not match.

```
<ProtectedRoute roles={['club', 'organizer']}>
  <PostOpportunityPage />
</ProtectedRoute>
```

---

## 2. Backend Module Architecture

Every backend module follows the same layered structure:

```
HTTP Request
     │
     ▼
┌──────────────────────────────────────────┐
│  MIDDLEWARE CHAIN (global)               │
│  helmet → cors → rateLimit →             │
│  requestLogger (pino-http) →             │
│  express.json() → authMiddleware         │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  ROUTE HANDLER                           │
│  backend/src/modules/<name>/routes.ts    │
│  - Zod req body/param/query validation   │
│  - Role guard middleware                 │
│  - Calls service method                  │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│  SERVICE LAYER                           │
│  backend/src/modules/<name>/service.ts   │
│  - Business logic                        │
│  - Orchestrates DB calls                 │
│  - Emits events to EventBus              │
│  - Throws typed errors (AppError)        │
└──────────────────┬───────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
┌──────────────────┐  ┌──────────────────────────┐
│  REPOSITORY      │  │  DIRECT PRISMA CLIENT    │
│  (4 modules)     │  │  (12 modules)            │
│  UserRepository  │  │  import { prisma } from  │
│  OppRepository   │  │  '../../lib/prisma'       │
│  AppRepository   │  └──────────────────────────┘
│  OrgRepository   │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│  PRISMA CLIENT                           │
│  database/prisma/schema.prisma           │
│  PostgreSQL via Supabase                 │
└──────────────────────────────────────────┘
```

### 2.1 Modules Using Repository Pattern

The following four modules have an explicit repository layer that abstracts Prisma behind an interface:

- `users` → `UserRepository`
- `opportunities` → `OpportunityRepository`
- `applications` → `ApplicationRepository`
- `organizations` → `OrganizationRepository`

The remaining twelve modules (`auth`, `posts`, `reels`, `blogs`, `follow`, `messaging`, `notifications`, `search`, `media`, `ai`, `verification`, `admin`) call Prisma directly from their service files. This inconsistency is documented as ARCH-006.

### 2.2 EventBus (Observer Pattern)

The backend has a singleton EventBus (Node.js `EventEmitter` subclass) at `backend/src/lib/eventBus.ts`. Services emit domain events; handler modules subscribe. This decouples side effects (notifications, email) from the primary transaction.

Key event emissions:

| Emitter Module   | Event Name                    | Handler Module      | Action                              |
|------------------|-------------------------------|---------------------|-------------------------------------|
| applications     | `application.submitted`       | notifications       | Notify club of new application      |
| applications     | `application.status_changed`  | notifications       | Notify athlete of status change     |
| applications     | `application.status_changed`  | email               | Email athlete status update         |
| follow           | `user.followed`               | notifications       | Notify followed user                |
| verification     | `org.verified`                | notifications       | Notify org owner                    |
| verification     | `org.verified`                | email               | Email org owner                     |
| posts            | `post.liked`                  | notifications       | Notify post author                  |
| messaging        | `message.sent`                | notifications       | Update unread count                 |

### 2.3 Error Handling

All service-layer errors are instances of `AppError`, which carries an HTTP status code and a machine-readable error code. The global error handler middleware at `backend/src/middleware/errorHandler.ts` converts `AppError` to a JSON response and logs non-5xx errors at `warn` level, 5xx at `error` level.

---

## 3. Complete API Surface

Base path: `/api`  
Auth: `Bearer <JWT access token>` unless noted as `public`.

### 3.1 Auth Module (`/api/auth`)

| Method | Path                    | Auth    | Description                                      |
|--------|-------------------------|---------|--------------------------------------------------|
| POST   | /auth/register          | public  | Register new user; sends email verification      |
| POST   | /auth/login             | public  | Login; returns access + refresh tokens           |
| POST   | /auth/refresh           | public  | Exchange refresh token for new token pair        |
| POST   | /auth/logout            | bearer  | Revoke refresh token                             |
| GET    | /auth/verify-email      | public  | Verify email address from link token             |
| POST   | /auth/forgot-password   | public  | Send password reset email                        |
| POST   | /auth/reset-password    | public  | Reset password using token from email            |
| GET    | /auth/me                | bearer  | Return current user profile                      |

### 3.2 Users Module (`/api/users`)

| Method | Path                        | Auth         | Description                               |
|--------|-----------------------------|--------------|-------------------------------------------|
| GET    | /users/:id                  | bearer       | Get public profile of any user            |
| PUT    | /users/profile              | bearer       | Update own profile data                   |
| PUT    | /users/athlete-data         | athlete      | Update athlete-specific JSON data         |
| PUT    | /users/coach-data           | club/scout   | Update coach/scout JSON data              |
| GET    | /users/:id/followers        | bearer       | List followers of a user                  |
| GET    | /users/:id/following        | bearer       | List users followed by a user             |
| DELETE | /users/account              | bearer       | Soft-delete own account                   |

### 3.3 Organizations Module (`/api/organizations`)

| Method | Path                            | Auth             | Description                            |
|--------|---------------------------------|------------------|----------------------------------------|
| POST   | /organizations                  | club/organizer   | Create organisation                    |
| GET    | /organizations/:id              | bearer           | Get organisation profile               |
| PUT    | /organizations/:id              | org_owner        | Update organisation details            |
| POST   | /organizations/:id/documents    | org_owner        | Upload verification documents (GCS)    |
| GET    | /organizations                  | bearer           | List / search organisations            |

### 3.4 Opportunities Module (`/api/opportunities`)

| Method | Path                            | Auth             | Description                            |
|--------|---------------------------------|------------------|----------------------------------------|
| POST   | /opportunities                  | club/organizer   | Create opportunity                     |
| GET    | /opportunities                  | bearer           | List open opportunities                |
| GET    | /opportunities/:id              | bearer           | Get single opportunity                 |
| PUT    | /opportunities/:id              | opp_owner        | Update opportunity details             |
| PATCH  | /opportunities/:id/close        | opp_owner        | Close opportunity                      |
| DELETE | /opportunities/:id              | opp_owner/admin  | Delete opportunity                     |
| GET    | /opportunities/:id/applications | opp_owner        | List all applications for opportunity  |

### 3.5 Applications Module (`/api/applications`)

| Method | Path                                    | Auth         | Description                               |
|--------|-----------------------------------------|--------------|-------------------------------------------|
| POST   | /applications                           | athlete      | Submit application to opportunity         |
| GET    | /applications/my                        | athlete      | List own applications                     |
| GET    | /applications/:id                       | bearer       | Get single application (owner or club)    |
| PATCH  | /applications/:id/shortlist             | club/org     | Move to shortlisted                       |
| PATCH  | /applications/:id/select                | club/org     | Move to selected                          |
| PATCH  | /applications/:id/reject                | club/org     | Move to rejected                          |
| PATCH  | /applications/:id/withdraw              | athlete      | Withdraw application                      |

### 3.6 Posts Module (`/api/posts`)

| Method | Path                     | Auth         | Description                                |
|--------|--------------------------|--------------|--------------------------------------------|
| POST   | /posts                   | bearer       | Create post (text + optional media)        |
| GET    | /posts/feed              | bearer       | Get following-based feed                   |
| GET    | /posts/:id               | bearer       | Get single post                            |
| PUT    | /posts/:id               | post_author  | Update post                                |
| DELETE | /posts/:id               | post_author/admin | Delete post                           |
| POST   | /posts/:id/like          | bearer       | Like a post                                |
| DELETE | /posts/:id/like          | bearer       | Unlike a post                              |
| GET    | /posts/:id/comments      | bearer       | Get comments on post                       |
| POST   | /posts/:id/comments      | bearer       | Add comment to post                        |
| DELETE | /posts/:id/comments/:cid | comment_author/admin | Delete comment                    |

### 3.7 Reels Module (`/api/reels`)

| Method | Path                     | Auth         | Description                                |
|--------|--------------------------|--------------|--------------------------------------------|
| POST   | /reels                   | athlete      | Create reel (video upload via GCS)         |
| GET    | /reels/feed              | bearer       | Get reel feed                              |
| GET    | /reels/:id               | bearer       | Get single reel                            |
| DELETE | /reels/:id               | reel_author/admin | Delete reel                           |
| POST   | /reels/:id/like          | bearer       | Like reel                                  |
| DELETE | /reels/:id/like          | bearer       | Unlike reel                                |
| POST   | /reels/:id/comments      | bearer       | Comment on reel                            |

### 3.8 Blogs Module (`/api/blogs`)

| Method | Path                     | Auth         | Description                                |
|--------|--------------------------|--------------|--------------------------------------------|
| POST   | /blogs                   | bearer       | Create blog post                           |
| GET    | /blogs                   | bearer       | List/browse blogs                          |
| GET    | /blogs/:id               | bearer       | Get single blog                            |
| PUT    | /blogs/:id               | blog_author  | Update blog                                |
| DELETE | /blogs/:id               | blog_author/admin | Delete blog                           |
| POST   | /blogs/:id/like          | bearer       | Like blog                                  |
| DELETE | /blogs/:id/like          | bearer       | Unlike blog                                |

### 3.9 Follow Module (`/api/follow`)

| Method | Path                     | Auth    | Description                                  |
|--------|--------------------------|---------|----------------------------------------------|
| POST   | /follow/:userId          | bearer  | Follow user                                  |
| DELETE | /follow/:userId          | bearer  | Unfollow user                                |

### 3.10 Messaging Module (`/api/messages`)

| Method | Path                              | Auth    | Description                                  |
|--------|-----------------------------------|---------|----------------------------------------------|
| GET    | /messages/conversations           | bearer  | List own conversations                       |
| POST   | /messages/conversations           | bearer  | Start new conversation                       |
| GET    | /messages/conversations/:id       | bearer  | Get conversation + messages                  |
| POST   | /messages/conversations/:id       | bearer  | Send message in conversation                 |
| PATCH  | /messages/conversations/:id/read  | bearer  | Mark conversation as read                    |

### 3.11 Notifications Module (`/api/notifications`)

| Method | Path                        | Auth    | Description                                  |
|--------|-----------------------------|---------|----------------------------------------------|
| GET    | /notifications              | bearer  | List notifications (paginated)               |
| GET    | /notifications/count        | bearer  | Get unread notification count (polled 30s)   |
| PATCH  | /notifications/:id/read     | bearer  | Mark notification as read                    |
| PATCH  | /notifications/read-all     | bearer  | Mark all notifications as read               |

### 3.12 Search Module (`/api/search`)

| Method | Path               | Auth    | Description                                         |
|--------|--------------------|---------|-----------------------------------------------------|
| GET    | /search/users      | bearer  | Search users by name, sport, role (Phase 1 SQL)     |
| GET    | /search/clubs      | bearer  | Search organisations by name, sport, type           |
| GET    | /search/opportunities | bearer | Search opportunities by sport, type, location    |

### 3.13 Media Module (`/api/media`)

| Method | Path                        | Auth    | Description                                  |
|--------|-----------------------------|---------|----------------------------------------------|
| POST   | /media/upload-url           | bearer  | Generate GCS signed upload URL               |
| POST   | /media/confirm              | bearer  | Confirm upload complete; record GCS path     |
| GET    | /media/download-url/:key    | bearer  | Generate signed download URL for private doc |

### 3.14 AI Module (`/api/ai`)

| Method | Path              | Auth    | Description                                          |
|--------|-------------------|---------|------------------------------------------------------|
| GET    | /ai/tips          | athlete | Generate AI performance tips for athlete's profile   |

### 3.15 Verification Module (`/api/verification`)

| Method | Path                              | Auth    | Description                                  |
|--------|-----------------------------------|---------|----------------------------------------------|
| GET    | /verification/pending             | admin   | List organisations pending verification      |
| PATCH  | /verification/:orgId/approve      | admin   | Approve organisation verification            |
| PATCH  | /verification/:orgId/reject       | admin   | Reject organisation verification             |

### 3.16 Admin Module (`/api/admin`)

| Method | Path                          | Auth    | Description                                  |
|--------|-------------------------------|---------|----------------------------------------------|
| GET    | /admin/users                  | admin   | List all users (paginated)                   |
| PATCH  | /admin/users/:id/ban          | admin   | Ban user account                             |
| PATCH  | /admin/users/:id/unban        | admin   | Unban user account                           |
| DELETE | /admin/posts/:id              | admin   | Delete any post (moderation)                 |
| DELETE | /admin/reels/:id              | admin   | Delete any reel (moderation)                 |
| GET    | /admin/audit-log              | admin   | Query audit log                              |
| GET    | /admin/reports                | admin   | List content reports                         |
| PATCH  | /admin/reports/:id/resolve    | admin   | Resolve a content report                     |

### 3.17 Email Logs Module (`/api/email-logs`)

| Method | Path              | Auth    | Description                                  |
|--------|-------------------|---------|----------------------------------------------|
| GET    | /email-logs       | admin   | List email delivery log records              |

### 3.18 Scoring SSO (`/scoring-api/api/auth`)

| Method | Path                       | Auth    | Description                                  |
|--------|----------------------------|---------|----------------------------------------------|
| POST   | /scoring-api/api/auth/sso  | bearer  | Exchange main JWT for scoring-scoped JWT     |

---

## 4. Authentication and Authorisation Flow

### 4.1 Registration (Step-by-Step)

```
Client                    Backend                      Database         Email Service
  │                          │                             │                  │
  │── POST /auth/register ──►│                             │                  │
  │   {email,password,role}  │                             │                  │
  │                          │── Zod validate ─────────────►                  │
  │                          │── bcrypt.hash(password,12) ─►                  │
  │                          │── prisma.user.create ───────►                  │
  │                          │   {email,passwordHash,role} │                  │
  │                          │◄── user record ─────────────│                  │
  │                          │── generate emailVerifToken  │                  │
  │                          │── prisma.emailVerification  │                  │
  │                          │   .create({token, userId})  │                  │
  │                          │──────── send verify email ──────────────────►  │
  │◄── 201 {message} ────────│                             │                  │
```

### 4.2 Email Verification

```
Client                    Backend                      Database
  │                          │                             │
  │── GET /auth/verify-email?token=<t> ──────────────────►│
  │                          │── find EmailVerification    │
  │                          │   where token = t           │
  │                          │── check not expired         │
  │                          │── prisma.user.update        │
  │                          │   {emailVerified: true}     │
  │                          │── delete EmailVerification  │
  │◄── 200 {verified: true} ─│                             │
```

### 4.3 Login and Token Issuance

```
Client                    Backend                      Database
  │                          │                             │
  │── POST /auth/login ─────►│                             │
  │   {email, password}      │── find user by email ──────►│
  │                          │◄── user {hash, role, id} ───│
  │                          │── bcrypt.compare(pwd, hash) │
  │                          │── if mismatch → 401         │
  │                          │── jwt.sign({id,role}, JWT_SECRET, {expiresIn:'15m'})
  │                          │── jwt.sign({id}, REFRESH_SECRET, {expiresIn:'30d'})
  │                          │── prisma.refreshToken.create({token,userId,expiresAt})
  │◄── 200 {accessToken,     │                             │
  │         refreshToken}    │                             │
```

### 4.4 Token Refresh (Rotation)

```
Client                    Backend                      Database
  │                          │                             │
  │── POST /auth/refresh ───►│                             │
  │   {refreshToken}         │── jwt.verify(token)         │
  │                          │── find RefreshToken in DB   │
  │                          │── check not revoked/expired │
  │                          │── delete old RefreshToken   │
  │                          │── issue new accessToken     │
  │                          │── issue new refreshToken    │
  │                          │── create new RefreshToken   │
  │◄── 200 {accessToken,     │                             │
  │         refreshToken}    │                             │
```

### 4.5 Authenticated Request Lifecycle

```
Client                    authMiddleware              routeHandler
  │                          │                             │
  │── GET /api/... ─────────►│                             │
  │   Authorization: Bearer <accessToken>                  │
  │                          │── jwt.verify(token)         │
  │                          │   if invalid → 401          │
  │                          │── req.user = decoded payload│
  │                          │── next() ──────────────────►│
  │                          │                    roleGuard│
  │                          │                    checks   │
  │                          │                    req.user.role│
  │                          │                    if mismatch→403│
  │◄── 200 {...} ────────────│◄── response ────────────────│
```

### 4.6 Frontend 401 Interceptor

The axios instance at `frontend/src/lib/api.ts` registers a response interceptor. When a `401` is received:
1. Call `POST /auth/refresh` with the stored refresh token.
2. If refresh succeeds: store new tokens in Zustand auth store, retry the original request with the new access token.
3. If refresh fails (refresh token expired or revoked): clear auth store, redirect to `/login`.

---

## 5. Application State Machine

An `Application` record transitions through the following states. Transitions are guarded by role and business rules.

```
                     ┌─────────────────────────────────┐
                     │           SUBMITTED              │
                     │     athlete → POST /applications │
                     └─────────────────┬───────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              │ [club: shortlist]      │ [club: reject]         │ [athlete: withdraw]
              ▼                        ▼                        ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────────┐
   │   SHORTLISTED    │   │    REJECTED      │   │       WITHDRAWN          │
   │ PATCH /shortlist │   │ PATCH /reject    │   │   PATCH /withdraw        │
   └────────┬─────────┘   └──────────────────┘   └──────────────────────────┘
            │                                      (terminal)
            │ [club: select]    [club: reject]
            ├──────────────────────────────────────►REJECTED (terminal)
            │
            ▼
   ┌──────────────────┐
   │    SELECTED      │
   │ PATCH /select    │
   └──────────────────┘
   (terminal)
```

### 5.1 State Definitions

| State       | Description                                                       |
|-------------|-------------------------------------------------------------------|
| pending     | Application received; club has not yet reviewed                   |
| shortlisted | Club has shortlisted athlete for further review or interview      |
| selected    | Club has selected athlete; recruitment complete                   |
| rejected    | Club has rejected application at any stage                        |
| withdrawn   | Athlete has withdrawn their own application                       |

### 5.2 Valid Transitions

| From        | To          | Actor   | Guard                              | Side Effects                            |
|-------------|-------------|---------|------------------------------------|-----------------------------------------|
| pending     | shortlisted | club    | Opportunity status = open          | Event: `application.status_changed`     |
| pending     | rejected    | club    | —                                  | Event: `application.status_changed`     |
| pending     | withdrawn   | athlete | —                                  | Event: `application.status_changed`     |
| shortlisted | selected    | club    | Opportunity vacancies > filled     | Event: `application.status_changed`; increment filled count |
| shortlisted | rejected    | club    | —                                  | Event: `application.status_changed`     |
| shortlisted | withdrawn   | athlete | —                                  | Event: `application.status_changed`     |

### 5.3 History Tracking

Every state transition appends a record to `Application.history` (JSON array):
```json
{
  "from": "pending",
  "to": "shortlisted",
  "by": "user-uuid-of-club-manager",
  "at": "2025-11-01T10:30:00Z",
  "note": "Strong portfolio reviewed"
}
```

---

## 6. Opportunity Lifecycle State Machine

```
                ┌──────────────────────────────────────┐
                │              OPEN                    │
                │  POST /opportunities (club/organizer) │
                └──────────────────┬───────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         │ [vacancies filled]      │ [deadline passed]       │ [club: manual close]
         ▼                         ▼                         ▼
┌──────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│      FILLED      │    │     CLOSED        │    │     CLOSED        │
│ (auto, service)  │    │ (auto, scheduler) │    │ PATCH /close      │
└──────────────────┘    └───────────────────┘    └───────────────────┘
     (terminal)               (terminal)               (terminal)
```

### 6.1 Auto-Fill Logic

In the `applications` service, when an application transitions to `selected`, the service checks whether `Opportunity.filled_count >= Opportunity.vacancies`. If so, it updates `Opportunity.status = 'filled'` within the same Prisma transaction.

### 6.2 Deadline Enforcement

A scheduled job (or on-read check) sets `Opportunity.status = 'closed'` when `application_deadline < NOW()`. New applications to a non-open opportunity are rejected with `400 OPPORTUNITY_NOT_OPEN`.

---

## 7. Scoring SSO Flow

The scoring subsystem uses its own JWT. A user authenticated in the main app exchanges their main JWT for a scoring-scoped JWT.

```
MainFrontend         MainBackend             ScoringBackend
     │                    │                        │
     │ user navigates to  │                        │
     │ scoring section    │                        │
     │                    │                        │
     │── POST /scoring-api/api/auth/sso ──────────►│
     │   Authorization: Bearer <mainJWT>            │
     │                                   │── verify mainJWT using
     │                                   │   SHARED_JWT_SECRET
     │                                   │── find/create scoring user
     │                                   │   record by main userId
     │                                   │── sign scoringJWT
     │                                   │   {userId, scope:'scoring'}
     │◄── 200 {scoringToken} ────────────│
     │
     │ store scoringToken in
     │ Zustand / localStorage
     │
     │── subsequent scoring API calls ──►│
     │   Authorization: Bearer <scoringToken>
```

The shared secret `SHARED_JWT_SECRET` (or the main app's `JWT_SECRET`) is set as an environment variable on the scoring backend container. The scoring backend validates the incoming main JWT to extract the user's identity, then issues its own scoped token.

---

## 8. Media Upload Flow

All file uploads use a two-step signed URL pattern to avoid routing large payloads through the Node.js API server.

```
Client                    Backend (media module)           GCS
  │                              │                          │
  │── POST /api/media/upload-url ►│                          │
  │   {fileName, contentType,    │                          │
  │    context: 'profile-photo'} │                          │
  │                              │── generate signed URL    │
  │                              │   (PUT, 10min expiry)   ──►
  │◄── 200 {signedUrl, key} ─────│                          │
  │                              │                          │
  │ (client uploads directly)    │                          │
  │── PUT <signedUrl> ──────────────────────────────────────►│
  │   Content-Type: image/jpeg   │                          │
  │   [binary body]              │                          │
  │◄── 200 OK ─────────────────────────────────────────────►│
  │                              │                          │
  │── POST /api/media/confirm ──►│                          │
  │   {key, context, entityId}   │                          │
  │                              │── verify key exists in GCS
  │                              │── prisma.user.update or  │
  │                              │   prisma.post.create with│
  │                              │   mediaUrl = GCS path    │
  │◄── 200 {mediaUrl} ───────────│                          │
```

For private documents (org verification):
- The bucket is private.
- The upload signed URL is scoped to the `sportivox-docs` bucket.
- Download access is via `GET /api/media/download-url/:key`, which generates a time-limited signed read URL returned only to authorised users (admin for verification docs, org owner for their own docs).

---

## 9. Database Entity Relationships

Simplified entity-relationship map showing primary foreign keys and cardinalities.

```
User ─────────────────────────────────────────────────────────────────────────┐
│ id (PK)                                                                      │
│ email                                                                        │
│ role                                                                         │
│ athlete_data (JSON)                                                          │
│ coach_data (JSON)                                                            │
│ follower_count                                                               │
│ following_count                                                              │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │ 1
           │
    ┌──────┴──────────────────────────────────────────────────┐
    │                                                         │
    │ N                                                       │ N
    ▼                                                         ▼
Organization ─────────────────────────────────┐     Application
│ id (PK)                                      │     │ id (PK)
│ owner_user_id → User.id                      │     │ opportunity_id → Opportunity.id
│ org_name                                     │     │ applicant_user_id → User.id
│ org_type                                     │     │ status (pending/shortlisted/...)
│ sport_categories []                          │     │ history (JSON[])
│ verification                                 │     └────────┬────────────────────────
└──────────────────────────────────────────────┘              │ N
           │ 1                                                 │
           │ N                                                 │ 1
           ▼                                                   ▼
Opportunity ──────────────────────────────────────────────────┘
│ id (PK)
│ org_id → Organization.id
│ type
│ sport
│ status (open/filled/closed)
│ application_count
│ vacancies
│ application_deadline


User ─────────────────────────────────────┐
  │ 1                                     │ 1
  │ N                                     │ N
  ▼                                       ▼
Post                  Reel             Blog
│ id (PK)             │ id (PK)        │ id (PK)
│ author_id→User.id   │ author_id      │ author_id
│ like_count          │ like_count     │ like_count
│ comment_count       │ comment_count  │ comment_count
│ view_count          │ view_count     │ view_count
└────────┬────────────┴────────┬───────┴────────┬──────────────
         │                     │                │
         └─────────────────────┴────────────────┘
                               │ N
                               ▼
                          Comment
                          │ id (PK)
                          │ author_id → User.id
                          │ parent_type (post/reel/blog)
                          │ post_id?, reel_id?, blog_id?


PostLike (composite PK: post_id, user_id)
ReelLike (composite PK: reel_id, user_id)
BlogLike (composite PK: blog_id, user_id)


Follow (follower_id → User.id, following_id → User.id)


Conversation ────────────────────────────────────────────────────
│ id (PK)
│ participant_ids (String[])   ← denormalised; only supports 1:1
│ last_message (JSON)
│ unread_counts (JSON)
└────────┬────────────────────────────────────────────────────────
         │ 1
         │ N
         ▼
       Message
       │ id (PK)
       │ conversation_id → Conversation.id
       │ sender_id → User.id
       │ recipient_id → User.id
       │ body


Notification (user_id → User.id, actor_id → User.id)
AuditLog    (actor_id → User.id)
Report      (reporter_id → User.id)
Verification (org_id → Organization.id, reviewed_by → User.id)
RefreshToken (user_id → User.id)
EmailVerification (user_id → User.id)
PasswordReset (user_id → User.id)
EmailLog (user_id → User.id)
```

---

## 10. Key Sequence Diagrams

### 10.1 Post a Feed Update

```
Athlete (Browser)        React Component        Hook/Service         Backend           GCS
       │                       │                     │                  │               │
       │ fill post form         │                     │                  │               │
       │ (text + image)         │                     │                  │               │
       │──────────────────────►│                     │                  │               │
       │                       │ submit form          │                  │               │
       │                       │────────────────────►│                  │               │
       │                       │                     │ POST /media/      │               │
       │                       │                     │ upload-url ──────►│               │
       │                       │                     │◄── {signedUrl,    │               │
       │                       │                     │     key}          │               │
       │                       │                     │ PUT signedUrl ────────────────────►
       │                       │                     │◄── 200 ──────────────────────────►
       │                       │                     │ POST /posts ─────►│               │
       │                       │                     │  {text, mediaKey} │               │
       │                       │                     │                   │ create Post    │
       │                       │                     │                   │ record in DB   │
       │                       │                     │                   │ emit post.created
       │                       │                     │◄── 201 {post} ────│               │
       │                       │ invalidate          │                   │               │
       │                       │ queryKeys.posts.all │                   │               │
       │◄── feed updates ──────│                     │                   │               │
```

### 10.2 Apply to Opportunity

```
Athlete (Browser)        Hook/Service           Backend           EventBus    NotifService
       │                     │                     │                 │              │
       │ click Apply          │                     │                 │              │
       │────────────────────►│                     │                 │              │
       │                     │ POST /applications ►│                 │              │
       │                     │  {opportunityId}    │                 │              │
       │                     │                     │ Zod validate    │              │
       │                     │                     │ check opp.status│              │
       │                     │                     │   = open        │              │
       │                     │                     │ check no exist. │              │
       │                     │                     │   application   │              │
       │                     │                     │ create Application              │
       │                     │                     │   status=pending│              │
       │                     │                     │ increment opp.  │              │
       │                     │                     │   application_  │              │
       │                     │                     │   count         │              │
       │                     │                     │ emit event ────►│              │
       │                     │                     │  application    │              │
       │                     │                     │  .submitted     │ notify ─────►│
       │                     │◄── 201 {application}│                 │ club         │
       │◄── success toast ───│                     │                 │              │
```

### 10.3 Send a Message

```
User A (Browser)         Hook/Service           Backend               DB
       │                     │                     │                   │
       │ open conversation    │                     │                   │
       │ type + send          │                     │                   │
       │────────────────────►│                     │                   │
       │                     │ POST /messages/      │                   │
       │                     │ conversations/:id ──►│                   │
       │                     │ {body: "Hello"}      │                   │
       │                     │                     │ find Conversation  │
       │                     │                     │ verify sender is   │
       │                     │                     │   participant      │
       │                     │                     │ create Message ───►│
       │                     │                     │ update Conversation│
       │                     │                     │   .last_message    │
       │                     │                     │ increment unread   │
       │                     │                     │   count for User B │
       │                     │                     │ emit message.sent  │
       │                     │◄── 201 {message} ───│                   │
       │◄── message appears  │                     │                   │
       │    in UI            │                     │                   │
       │                     │                     │                   │
       │                                           │  (User B polls    │
       │                                           │  GET /notifications│
       │                                           │  /count every 30s) │
```

---

## 11. Frontend Component Hierarchy

```
App (React Router Provider + QueryClientProvider + Zustand)
├── PublicLayout
│   ├── LandingPage
│   ├── LoginPage
│   ├── RegisterPage
│   └── ForgotPasswordPage
│
└── ProtectedLayout (requires auth)
    ├── Navbar (global, reads authStore)
    ├── Sidebar (role-specific links)
    │
    ├── DashboardPage (role-specific dashboard)
    │
    ├── FeedPage
    │   ├── PostCard[]
    │   │   ├── LikeButton
    │   │   ├── CommentSection
    │   │   └── ReportButton
    │   └── CreatePostForm
    │
    ├── ReelsPage
    │   └── ReelCard[]
    │
    ├── BlogsPage
    │   ├── BlogCard[]
    │   └── CreateBlogForm
    │
    ├── OpportunitiesPage
    │   ├── OpportunityFilters (client-side — ARCH-010)
    │   ├── OpportunityCard[]
    │   └── [ProtectedRoute roles=club,organizer]
    │       └── CreateOpportunityForm
    │
    ├── ApplicationsPage (athlete: own apps | club: apps to their opps)
    │   └── ApplicationCard[]
    │       └── ApplicationStatusBadge
    │
    ├── ProfilePage/:id
    │   ├── ProfileHeader
    │   ├── AthleteStatsSection (if athlete)
    │   ├── MediaGallery
    │   ├── FollowButton
    │   └── AITipsSection (own profile only)
    │
    ├── MessagesPage
    │   ├── ConversationList
    │   └── MessageThread
    │       └── MessageBubble[]
    │
    ├── SearchPage
    │   ├── SearchBar
    │   └── SearchResults (users | clubs | opportunities tabs)
    │
    ├── NotificationsPage
    │   └── NotificationItem[]
    │
    ├── [ProtectedRoute roles=admin]
    │   └── AdminPanel
    │       ├── UserManagement
    │       ├── VerificationQueue
    │       ├── ContentModeration
    │       └── AuditLogViewer
    │
    └── [ProtectedRoute roles=scorer]
        └── ScoringSection (proxied to scoring subsystem)
```

---

## 12. Service Layer Call Graph

Showing which frontend hooks call which service functions, and which backend routes they reach.

```
useOpportunities (hook)
  ├── opportunityService.getOpportunities()  → GET /api/opportunities
  ├── opportunityService.getOpportunity(id)  → GET /api/opportunities/:id
  ├── opportunityService.createOpportunity() → POST /api/opportunities
  └── opportunityService.closeOpportunity()  → PATCH /api/opportunities/:id/close

useApplications (hook)
  ├── applicationService.getMyApplications()    → GET /api/applications/my
  ├── applicationService.apply(oppId)           → POST /api/applications
  ├── applicationService.withdraw(id)           → PATCH /api/applications/:id/withdraw
  ├── applicationService.shortlist(id)          → PATCH /api/applications/:id/shortlist
  ├── applicationService.select(id)             → PATCH /api/applications/:id/select
  └── applicationService.reject(id)             → PATCH /api/applications/:id/reject

useProfile (hook)
  ├── userService.getProfile(id)                → GET /api/users/:id
  ├── userService.updateProfile(data)           → PUT /api/users/profile
  └── userService.updateAthleteData(data)       → PUT /api/users/athlete-data

useFeed (hook)
  ├── postService.getFeed()                     → GET /api/posts/feed
  ├── postService.createPost(data)              → POST /api/posts
  ├── postService.likePost(id)                  → POST /api/posts/:id/like
  └── postService.getComments(id)               → GET /api/posts/:id/comments

useReels (hook)
  ├── reelService.getReelFeed()                 → GET /api/reels/feed
  ├── reelService.createReel(data)              → POST /api/reels
  └── reelService.likeReel(id)                  → POST /api/reels/:id/like

useMessages (hook)
  ├── messageService.getConversations()         → GET /api/messages/conversations
  ├── messageService.getConversation(id)        → GET /api/messages/conversations/:id
  ├── messageService.sendMessage(id, body)      → POST /api/messages/conversations/:id
  └── messageService.markRead(id)               → PATCH /api/messages/conversations/:id/read

useNotifications (hook)
  ├── notificationService.getNotifications()    → GET /api/notifications
  ├── notificationService.getUnreadCount()      → GET /api/notifications/count [polled 30s]
  └── notificationService.markRead(id)          → PATCH /api/notifications/:id/read

useSearch (hook)
  ├── searchService.searchUsers(query)          → GET /api/search/users
  ├── searchService.searchClubs(query)          → GET /api/search/clubs
  └── searchService.searchOpportunities(query)  → GET /api/search/opportunities

useMedia (hook)
  ├── mediaService.getUploadUrl(meta)           → POST /api/media/upload-url
  ├── mediaService.uploadToGCS(url, file)       → PUT <signedUrl> (direct to GCS)
  └── mediaService.confirmUpload(key, ctx)      → POST /api/media/confirm

useAITips (hook)
  └── aiService.getTips()                       → GET /api/ai/tips

useFollow (hook)
  ├── followService.follow(userId)              → POST /api/follow/:userId
  └── followService.unfollow(userId)            → DELETE /api/follow/:userId

useOrganization (hook)
  ├── orgService.getOrg(id)                     → GET /api/organizations/:id
  ├── orgService.createOrg(data)                → POST /api/organizations
  └── orgService.uploadDocuments(id, files)     → POST /api/organizations/:id/documents

useVerification (hook) [admin only]
  ├── verificationService.getPending()          → GET /api/verification/pending
  ├── verificationService.approve(orgId)        → PATCH /api/verification/:orgId/approve
  └── verificationService.reject(orgId)         → PATCH /api/verification/:orgId/reject

useAdmin (hook) [admin only]
  ├── adminService.getUsers()                   → GET /api/admin/users
  ├── adminService.banUser(id)                  → PATCH /api/admin/users/:id/ban
  ├── adminService.getAuditLog()                → GET /api/admin/audit-log
  └── adminService.getReports()                 → GET /api/admin/reports

useScoring (hook) [scorer only]
  └── scoringService.ssoExchange(mainToken)     → POST /scoring-api/api/auth/sso
      └── (subsequent calls use scoring JWT)
          → GET/POST /scoring-api/api/matches
          → GET/POST /scoring-api/api/innings
          → POST /scoring-api/api/balls
```
