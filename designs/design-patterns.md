# Design Patterns — Sportivox / Sportzicon

This document records every design pattern implemented across the backend and frontend,
why each was chosen, where it lives in the codebase, and how the pieces connect.

---

## Table of Contents

1. [State Machine](#1-state-machine-pattern)
2. [Observer / Event Bus](#2-observer--event-bus-pattern)
3. [Repository](#3-repository-pattern)
4. [Service Layer + Dependency Inversion](#4-service-layer--dependency-inversion-principle)
5. [Decorator](#5-decorator-pattern)
6. [Custom Hook](#6-custom-hook-pattern-react)
7. [Query Key Factory](#7-query-key-factory-pattern)
8. [Facade](#8-facade-pattern)
9. [Model Separation (DTO)](#9-model-separation--dto-pattern)
10. [Factory](#10-factory-pattern)
11. [Singleton](#11-singleton-pattern)
12. [Chain of Responsibility](#12-chain-of-responsibility-pattern)
13. [Template Method](#13-template-method-pattern)
14. [Strategy](#14-strategy-pattern)
15. [Proxy](#15-proxy-pattern)
16. [Composite](#16-composite-pattern)
17. [Command](#17-command-pattern)
18. [Adapter](#18-adapter-pattern)
19. [Module](#19-module-pattern)

---

## 1. State Machine Pattern

### What it is

A formal model of an entity's lifecycle. The current state is explicit, every legal
transition is declared up-front, and listeners (side-effects) are attached to specific
states — not buried inside business-logic functions. Illegal transitions throw before
any mutation happens.

### Problem it solves

Before this pattern, the application status transitions lived in a plain object lookup
inside `applications.service.ts`. Side-effects (vacancy decrement, athlete availability
update, notification) were all written inline in a single 170-line function. Adding a
new state (e.g. `interview_scheduled`) required editing that function in multiple places.

### Implementation

#### Library

```
backend/src/lib/StateMachine.ts
```

Generic class that any domain workflow can use:

```ts
const machine = new StateMachine<ApplicationStatus>(currentStatus, APPLICATION_TRANSITIONS);

machine.on("selected",    async () => { /* decrement vacancy */ });
machine.on("selected",    async () => { /* set athlete availability = not_available */ });
machine.on("shortlisted", async () => { /* send notification */ });

await machine.transition("selected", context);   // throws if illegal
```

Key methods:
| Method | Purpose |
|--------|---------|
| `can(next)` | Returns `true` if the transition is legal from current state |
| `transition(next, ctx?)` | Validates, moves state, runs all registered listeners sequentially |
| `on(state, handler)` | Registers an async side-effect to fire when `state` is entered |

#### Workflow definitions (pure data, no logic)

```
backend/src/workflows/applicationWorkflow.ts
backend/src/workflows/opportunityWorkflow.ts
```

Each file exports an array of `Transition<S>` objects — the only place where valid
state paths are declared:

```ts
// applicationWorkflow.ts
export const APPLICATION_TRANSITIONS: Transition<ApplicationStatus>[] = [
  { from: "pending",     to: "shortlisted" },
  { from: "pending",     to: "rejected"    },
  { from: "shortlisted", to: "selected"    },
  { from: "shortlisted", to: "rejected"    },
  { from: ["pending", "shortlisted", "selected"], to: "withdrawn" },
];
```

#### Consumer

```
backend/src/modules/applications/applications.service.ts  (transition function)
```

The `transition()` service function instantiates the machine, registers listeners, and
calls `machine.transition(next)`. The machine enforces legality; listeners own all
side-effects; the function only persists the new state and emits a domain event.

---

## 2. Observer / Event Bus Pattern

### What it is

Services emit typed domain events. Separate handler functions subscribe to those events
and execute side-effects (notifications, emails, analytics). The emitting service has no
knowledge of its subscribers — coupling is fully removed.

### Problem it solves

Before this pattern, `applications.service`, `follow.service`, and `messaging.service`
all imported `notifications.service` directly and called `createNotification()` inline.
Adding a new side-effect (push notification, Slack webhook, analytics) required editing
each of those service files.

### Implementation

#### Library

```
backend/src/lib/EventBus.ts
```

```ts
class EventBus {
  emit<T>(event: string, payload: T): void   // fire-and-forget; handler errors are caught
  on<T>(event: string, handler: AsyncHandler<T>): void
}

export const eventBus = new EventBus();
```

Handlers run in parallel. A failing handler logs a warning and does **not** abort the
remaining handlers or the calling service.

#### Event type definitions

```
backend/src/events/types.ts
```

Every event has a string constant and a typed payload interface:

```ts
export const APP_APPLIED       = "application.applied";
export const APP_TRANSITIONED  = "application.transitioned";
export const USER_FOLLOWED     = "user.followed";
export const MESSAGE_SENT      = "message.sent";
```

#### Handler

```
backend/src/events/handlers/notificationHandler.ts
```

Subscribes to all four domain events. This is the **only** file that calls
`createNotification()`:

```ts
eventBus.on<ApplicationAppliedEvent>(APP_APPLIED, async (e) => {
  await createNotification({ user_id: e.posterId, ... });
});
```

#### Bootstrap (startup wiring)

```
backend/src/events/bootstrap.ts   ← registers all handlers
backend/src/app.ts                ← calls bootstrapEventHandlers() before HTTP opens
```

#### Emitters (after the refactor)

| Service | Event emitted |
|---------|--------------|
| `applications.service.ts` | `APP_APPLIED`, `APP_TRANSITIONED` |
| `follow.service.ts` | `USER_FOLLOWED` |
| `messaging.service.ts` | `MESSAGE_SENT` |

None of these services import `notifications.service` anymore.

---

## 3. Repository Pattern

### What it is

An interface that abstracts every data-access operation for a domain aggregate. Business
logic depends on the interface, not on Prisma. Swapping the database, adding a Redis
cache, or mocking in unit tests only requires a new implementation — services are
untouched.

### Problem it solves

Every backend service function imported `prisma` directly. Testing any service in
isolation required a live database. Changing a query touched business-logic files.

### Implementation

#### Interfaces

```
backend/src/repositories/interfaces/IApplicationRepository.ts
backend/src/repositories/interfaces/IOpportunityRepository.ts
backend/src/repositories/interfaces/INotificationRepository.ts
backend/src/repositories/interfaces/IUserRepository.ts
```

Each interface declares the exact operations a service is allowed to perform:

```ts
export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationRecord | null>;
  findByOpportunityAndApplicant(oppId: string, userId: string): Promise<...>;
  findManyByApplicant(userId: string, limit?: number): Promise<ApplicationRecord[]>;
  findManyByOpportunity(opportunityId: string): Promise<ApplicationRecord[]>;
  create(data: CreateApplicationData): Promise<ApplicationRecord>;
  update(id: string, data: UpdateApplicationData): Promise<ApplicationRecord>;
}
```

#### Prisma implementations

```
backend/src/repositories/prisma/PrismaApplicationRepository.ts
backend/src/repositories/prisma/PrismaOpportunityRepository.ts
backend/src/repositories/prisma/PrismaNotificationRepository.ts
backend/src/repositories/prisma/PrismaUserRepository.ts
```

Each class receives a `PrismaClient` via constructor and implements the matching
interface.

#### DI wiring (singleton object)

```
backend/src/repositories/index.ts
```

```ts
export const repositories = {
  application:  new PrismaApplicationRepository(prisma),
  opportunity:  new PrismaOpportunityRepository(prisma),
  notification: new PrismaNotificationRepository(prisma),
  user:         new PrismaUserRepository(prisma),
};
```

Swap any entry with a mock implementation in tests — no service file changes needed.

#### Consumers

| Service | Repositories used |
|---------|------------------|
| `applications.service.ts` | `application`, `opportunity`, `user` |
| `notifications.service.ts` | `notification`, `user` |

---

## 4. Service Layer + Dependency Inversion Principle

### What it is

All HTTP calls are centralised in typed service classes. Each class receives its HTTP
client via constructor injection — pages and hooks depend on an abstraction (the class
type), not on a hardcoded `axios` call. Swapping the transport (or mocking in tests)
only requires passing a different `AxiosInstance`.

### Problem it solves

Pages previously called `api.get("/posts/feed", ...)`, `api.delete("/opportunities/123")`
etc. directly inline. Endpoint URLs were duplicated, response unwrapping was duplicated,
and there was no single place to change a URL or add a header.

### Implementation

#### Service classes (frontend)

```
frontend/src/services/post.service.ts
frontend/src/services/opportunity.service.ts
frontend/src/services/application.service.ts
frontend/src/services/blog.service.ts
frontend/src/services/comment.service.ts
frontend/src/services/message.service.ts
frontend/src/services/notification.service.ts
frontend/src/services/user.service.ts
frontend/src/services/auth.service.ts
frontend/src/services/organization.service.ts
frontend/src/services/reel.service.ts
frontend/src/services/search.service.ts
```

Every class follows the same shape:

```ts
export class PostService {
  constructor(private readonly client: AxiosInstance) {}

  async getFeed(limit = 30): Promise<Post[]> {
    const res = await this.client.get<{ items: Post[] }>("/posts/feed", { params: { limit } });
    return res.data.items;
  }
  // ...
}
```

#### DI wiring

```
frontend/src/services/index.ts
```

The `build()` helper instantiates each class with the shared `api` client and applies
decorators (see Pattern 5). This is the only place where `api` is coupled to services.

#### Pages and hooks after the refactor

Pages no longer import `api`. They import from `services` or call a custom hook:

```ts
// Before
const res = await api.get<{ items: Post[] }>("/posts/feed", { params: { limit: 30 } });

// After
const posts = await postService.getFeed(30);
```

---

## 5. Decorator Pattern

### What it is

Wraps an existing object with new behaviour without modifying its source code.
Decorators are composable — stack them in any order to build cross-cutting concerns
like retry, logging, caching, or rate-limiting independently of the service classes.

### Problem it solves

Adding retry logic or console logging to every service method would require editing each
class. The Decorator pattern applies these concerns once, externally, and the service
classes remain clean.

### Implementation

#### `withRetry`

```
frontend/src/services/decorators/withRetry.ts
```

ES6 `Proxy` that intercepts every async method call. On failure, it retries up to
`options.retries` times (default 2) with exponential back-off. Client errors (4xx) are
not retried — only network failures and 5xx responses.

```ts
export function withRetry<T extends object>(service: T, options?: RetryOptions): T {
  return new Proxy(service, {
    get(target, prop) {
      // intercept async methods → wrap with retry loop
    }
  });
}
```

#### `withLogging`

```
frontend/src/services/decorators/withLogging.ts
```

ES6 `Proxy` that logs every method call with its arguments on entry and its result (or
error) on exit. Active in development only — returns the original instance unchanged in
production.

#### Composition in the DI wiring

```
frontend/src/services/index.ts
```

```ts
function build<T extends object>(instance: T, name: string): T {
  return withLogging(withRetry(instance, { retries: 2 }), name);
}

export const postService = build(new PostService(api), "PostService");
// Call order: withLogging (entry) → withRetry → HTTP call → withRetry (retry if fail) → withLogging (exit)
```

All 12 service singletons are wrapped with both decorators through the single `build()`
call.

---

## 6. Custom Hook Pattern (React)

### What it is

A React hook that encapsulates one domain's query and mutation logic — the `queryKey`,
`queryFn`, `onSuccess` invalidation, and any local state (e.g. optimistic liked-set).
Pages call the hook and consume the returned objects; they never touch React Query
machinery directly.

### Problem it solves

Every page previously contained inline `useQuery` / `useMutation` calls with hardcoded
query keys and duplicated `onSuccess` callbacks. The same feed query appeared in both
`Feed.tsx` and `Dashboard.tsx` with different keys, causing cache mismatches.

### Implementation

```
frontend/src/hooks/useFeed.ts
frontend/src/hooks/useOpportunities.ts     (useOpportunities, useOpportunity, useOpportunityForm)
frontend/src/hooks/useApplications.ts      (useMyApplications, useApplicants)
frontend/src/hooks/useBlogs.ts             (useBlogs, useBlog)
frontend/src/hooks/useMessages.ts          (useConversations, useMessages, useUserProfile)
frontend/src/hooks/useNotifications.ts     (useNotificationCount, useNotifications)
frontend/src/hooks/useComments.ts
frontend/src/hooks/useReels.ts
frontend/src/hooks/index.ts               (barrel export)
```

Example — every mutation callback and query key is in one place:

```ts
// hooks/useFeed.ts
export function useFeed(limit = 30) {
  const qc = useQueryClient();

  const feed   = useQuery({ queryKey: queryKeys.feed(limit), queryFn: () => postService.getFeed(limit) });
  const create = useMutation({ mutationFn: (data) => postService.create(data),
                               onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }) });
  const remove = useMutation({ mutationFn: (id) => postService.delete(id),
                               onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }) });

  return { feed, create, remove, toggleLike, likedPosts };
}

// Feed.tsx — pure presentation
const { feed, create, remove, toggleLike, likedPosts } = useFeed(30);
```

Pages that consume hooks:

| Hook | Pages / components |
|------|--------------------|
| `useFeed` | `Feed.tsx`, `Dashboard.tsx` |
| `useOpportunities` | `Opportunities.tsx`, `Dashboard.tsx` |
| `useOpportunity` | `OpportunityDetail.tsx` |
| `useOpportunityForm` | `NewOpportunity.tsx` |
| `useMyApplications` | `MyApplications.tsx`, `Dashboard.tsx` |
| `useApplicants` | `Applicants.tsx` |
| `useBlogs` | `Blogs.tsx` |
| `useBlog` | `BlogDetail.tsx`, `NewBlog.tsx` |
| `useConversations`, `useMessages` | `Messages.tsx` |
| `useNotificationCount` | `Layout.tsx` |
| `useNotifications` | `Notifications.tsx` |
| `useComments` | `CommentSection.tsx` |
| `useReels` | `Reels.tsx` |

---

## 7. Query Key Factory Pattern

### What it is

A single constant object that is the only source of truth for all React Query cache key
arrays. Every `useQuery` and `invalidateQueries` call references `queryKeys.*` — no raw
string arrays anywhere in the application.

### Problem it solves

Before this pattern, query keys were scattered string arrays: `["feed-all"]`, `["feed"]`,
`["opp", id]`, `["opportunities", params]`. A key mismatch between a fetch and an
invalidation caused stale UI. Renaming a domain required a global search-and-replace.

### Implementation

```
frontend/src/hooks/queryKeys.ts
```

```ts
export const queryKeys = {
  feed:           (limit?: number) => limit ? ["feed", limit] : ["feed"],
  opportunities:  (filters?)       => ["opportunities", filters ?? {}],
  opportunity:    (id: string)     => ["opportunity", id],
  myApplications: ()               => ["applications", "mine"],
  applicants:     (oppId: string)  => ["applicants", oppId],
  blogs:          (filters?)       => ["blogs", filters ?? {}],
  blog:           (id: string)     => ["blog", id],
  conversations:  ()               => ["conversations"],
  messages:       (convId: string) => ["messages", convId],
  notifCount:     ()               => ["notifications", "count"],
  notifications:  ()               => ["notifications", "list"],
  comments:       (type, id)       => ["comments", type, id],
  user:           (id: string)     => ["user", id],
  search:         (mode, params)   => ["search", mode, params],
} as const;
```

Used in 40+ places across all 8 hook files. Changing a key structure is a one-line edit
in this file.

---

## 8. Facade Pattern

### What it is

A service class provides a simplified interface over a complex subsystem (axios instance
+ URL construction + response unwrapping + error handling). Callers see named methods
with typed return values, not raw HTTP machinery.

### How it differs from the Service Layer pattern

The Service Layer describes the *architectural role* (separating HTTP concerns from UI
concerns). The Facade describes the *structural mechanism* — the class hides complexity
behind a simple surface. Every service class in this project is both.

### Implementation

All 12 service classes serve as Facade implementations:

```
frontend/src/services/post.service.ts
frontend/src/services/opportunity.service.ts
frontend/src/services/application.service.ts
frontend/src/services/blog.service.ts
frontend/src/services/comment.service.ts
frontend/src/services/message.service.ts
frontend/src/services/notification.service.ts
frontend/src/services/user.service.ts
frontend/src/services/auth.service.ts
frontend/src/services/organization.service.ts
frontend/src/services/reel.service.ts
frontend/src/services/search.service.ts
```

What the Facade hides from callers:

| Hidden complexity | Facade surface |
|-------------------|---------------|
| `api.get<{items:Post[]}>("/posts/feed",{params:{limit}}).then(r=>r.data.items)` | `postService.getFeed(limit)` |
| `api.post("/opportunities/${id}/apply", form, {headers:{"Content-Type":"multipart/form-data"}})` | `opportunityService.apply(id, formData)` |
| `api.get("/notifications/count").then(r=>r.data.unread)` | `notificationService.getUnreadCount()` |
| `api.delete("/posts/${id}/like")` | `postService.unlike(id)` |

---

## 9. Model Separation / DTO Pattern

### What it is

Domain entity shapes are pure TypeScript interfaces in their own layer, with no methods
and no behaviour. Service classes own the HTTP operations. UI components own the
rendering. No layer crosses into another.

### Problem it solves

The original `types.ts` was a single flat file with loosely typed interfaces (several
used `Record<string, any>`). Importing a type meant importing the whole file.
Models, API request shapes, and response wrappers were not distinguished.

### Implementation

#### Model files

```
frontend/src/models/user.model.ts         User, Role, UpdateAthleteRequest
frontend/src/models/organization.model.ts Organization
frontend/src/models/opportunity.model.ts  Opportunity, OpportunityFilters,
                                           CreateOpportunityRequest, ApplyRequest
frontend/src/models/application.model.ts  Application, ApplicationStatus,
                                           ApplicationHistoryEntry
frontend/src/models/post.model.ts         Post, PostAuthor, CreatePostRequest,
                                           UpdatePostRequest
frontend/src/models/reel.model.ts         Reel, ReelAuthor
frontend/src/models/blog.model.ts         Blog, BlogFilters
frontend/src/models/notification.model.ts Notification
frontend/src/models/comment.model.ts      CommentDoc, CommentParentType,
                                           AddCommentRequest, UpdateCommentRequest
frontend/src/models/message.model.ts      Message, Conversation, SendMessageRequest
frontend/src/models/index.ts              Single barrel export
```

#### Backward-compatibility shim

```
frontend/src/types.ts
```

Re-exports everything from `models/` so any pages not yet migrated continue to compile
unchanged. New code always imports from `../models` directly.

#### Separation enforced by layer

```
models/   → pure interfaces only (no imports from services or components)
services/ → imports from models, never from pages or hooks
hooks/    → imports from services and models, never from pages
pages/    → imports from hooks and models only
```

---

## Pattern Dependency Map

```
FRONTEND

  Singleton ──→ api (AxiosInstance)
                     │
            Factory (build())
                     │ decorates via Proxy
         ┌───────────▼───────────────────────┐
         │  Decorator: withRetry + withLogging │
         └───────────┬───────────────────────┘
                     │ wraps
         ┌───────────▼───────────┐
         │   services/ (Facade)  │  Service Layer + DI
         │   XService.method()   │
         └───────────┬───────────┘
                     │ called by
         ┌───────────▼───────────┐
         │  hooks/ (Custom Hook) │  Query Key Factory
         │  useX() → {data,mut} │
         └───────────┬───────────┘
                     │ consumed by
         ┌───────────▼───────────┐
         │  pages/ (Composite)   │  ProtectedRoute guard
         └───────────────────────┘
                     ↑
              models/ (DTO)  — typed interfaces, imported by all layers

BACKEND

  Singleton ──→ prisma, logger, eventBus
                     │
  Factory ──→ createApp(), BadRequest(), NotFound()
                     │
  ┌─────────────────▼──────────────────────────────────┐
  │  Chain of Responsibility  (Express middleware pipe)  │
  │  requestId → rateLimit → auth → validate → handler  │
  │                                   │                  │
  │              Template Method: asyncHandler wraps fn  │
  └─────────────────┬──────────────────────────────────┘
                    │ handler calls
       ┌────────────▼──────────┐
       │  repositories/        │  Repository Pattern
       │  IXRepository         │  (interfaces + Prisma impls)
       └────────────┬──────────┘
                    │ injected into
       ┌────────────▼──────────┐
       │   services/ (Strategy)│  domain logic
       │   (domain functions)  │──── emits ──→ EventBus (Observer) ──→ handlers
       └────────────┬──────────┘
                    │ transitions via
       ┌────────────▼──────────┐
       │  StateMachine<S>      │  + Workflow definitions
       └───────────────────────┘
```

---

## 10. Factory Pattern

### What it is

A function or method whose sole job is to create and return an object, hiding the
construction details from the caller. Callers never write `new HttpError(400, ...)` —
they call `BadRequest("Age eligibility not met")` and receive a fully-configured
instance. This centralises construction logic and makes it easy to change the created
type without touching every call site.

### Three instances in this codebase

#### Error factories — `backend/src/utils/errors.ts`

Every HTTP error in the backend is created through a factory function, not through
a direct `new HttpError(...)` constructor call:

```ts
export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

// Factory functions — callers never see the constructor
export const BadRequest      = (msg = "Bad request", details?: unknown) => new HttpError(400, "BAD_REQUEST", msg, details);
export const Unauthorized    = (msg = "Unauthorized")                   => new HttpError(401, "UNAUTHORIZED", msg);
export const Forbidden       = (msg = "Forbidden")                      => new HttpError(403, "FORBIDDEN", msg);
export const NotFound        = (msg = "Not found")                      => new HttpError(404, "NOT_FOUND", msg);
export const Conflict        = (msg = "Conflict")                       => new HttpError(409, "CONFLICT", msg);
export const TooManyRequests = (msg = "Too many requests")              => new HttpError(429, "RATE_LIMITED", msg);
export const Internal        = (msg = "Internal server error")          => new HttpError(500, "INTERNAL", msg);
```

Used in every backend service and middleware — over 30 call sites across 16 modules.

#### App factory — `backend/src/app.ts`

`createApp()` constructs and configures the entire Express application — middleware,
routes, CORS, security headers — and returns it. `server.ts` calls it without knowing
anything about the internals:

```ts
// app.ts
export function createApp(): Express { ... }

// server.ts
const app = createApp();
app.listen(env.PORT);
```

This makes the app independently testable: a test can call `createApp()` and mount it
against `supertest` without starting an actual server.

#### Service builder factory — `frontend/src/services/index.ts`

The `build()` helper is a factory that wraps any service instance in the two decorators:

```ts
function build<T extends object>(instance: T, name: string): T {
  return withLogging(withRetry(instance, { retries: 2 }), name);
}

export const postService = build(new PostService(api), "PostService");
```

Adding a new decorator to every service requires changing one line inside `build()`.

---

## 11. Singleton Pattern

### What it is

A class or module that is instantiated exactly once for the lifetime of the process.
All callers share the same instance. Used for stateful resources (database connections,
HTTP clients, loggers) where creating multiple instances would be wasteful or incorrect.

### Problem it solves

Creating a new Prisma client per request would exhaust the database connection pool.
Creating a new logger per module would lose correlation between log lines. Creating a
new axios instance per service would bypass the shared auth interceptors.

### Instances in this codebase

#### Backend

| Singleton | File | How it is enforced |
|-----------|------|--------------------|
| `prisma` (PrismaClient) | `backend/src/config/prisma.ts` | Module-level `export const` — Node.js module cache ensures one instance |
| `logger` (Pino) | `backend/src/config/logger.ts` | Same module-cache pattern |
| `eventBus` (EventBus) | `backend/src/lib/EventBus.ts` | Module-level instance export |
| `env` (validated config) | `backend/src/config/env.ts` | Module-level `export const` — fails fast if invalid |

#### Frontend

| Singleton | File | How it is enforced |
|-----------|------|--------------------|
| `api` (AxiosInstance) | `frontend/src/api/client.ts` | Module-level `export const` |
| `postService`, `opportunityService`, … (12 services) | `frontend/src/services/index.ts` | Module-level exports — instantiated once at import time |
| `useAuthStore` (Zustand) | `frontend/src/store/auth.ts` | Zustand `create()` returns a single store hook shared across all consumers |
| `useSavedOpportunities` | `frontend/src/store/savedOpportunities.ts` | Same Zustand pattern |
| `useFavoritesStore` | `frontend/src/store/favorites.ts` | Same Zustand pattern, with custom Set serialisation for localStorage |

#### Code examples

```ts
// backend/src/config/prisma.ts — DB connection singleton
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient({ log: ["error"] });
// Every module that writes `import { prisma } from "../../config/prisma"`
// receives the same connection pool — no duplicate connections.

// backend/src/lib/EventBus.ts — event bus singleton
class EventBus { /* ... */ }
export const eventBus = new EventBus();   // one instance for the whole process

// frontend/src/store/auth.ts — Zustand singleton store
export const useAuthStore = create<AuthState>()(
  persist((set) => ({
    user: null,
    setSession: ({ user, accessToken, refreshToken }) =>
      set({ user, accessToken, refreshToken }),
    clear: () => set({ user: null, accessToken: null, refreshToken: null }),
  }), { name: "sportivox.auth" })
);
// Any component calling useAuthStore() reads from the same global state.

// frontend/src/services/index.ts — service singletons
export const postService        = build(new PostService(api),        "PostService");
export const opportunityService = build(new OpportunityService(api), "OpportunityService");
// Imported by 13 pages — all share the same decorated instance.
```

---

## 12. Chain of Responsibility Pattern

### What it is

A sequence of handler objects where each handler either processes a request or passes
it to the next handler in the chain. The sender does not know which handler will
ultimately handle the request. Express middleware is the canonical Node.js application
of this pattern — each `RequestHandler` function receives `(req, res, next)` and calls
`next()` to pass control forward, or `next(err)` to skip to the error handler.

### Problem it solves

Without this pattern, every route function would contain its own authentication check,
validation logic, rate-limiting, and error formatting. Those cross-cutting concerns
would be duplicated across every endpoint. With middleware chains, each concern is
written once and composed declaratively.

### Implementation

#### Global pipeline — `backend/src/app.ts`

```
HTTP request
    │
    ▼
requestId        (attach unique trace ID to every request)
    │
    ▼
pinoHttp         (structured request/response logging)
    │
    ▼
apiLimiter       (global rate limit — 300 req / 15 min)
    │
    ▼
[route handlers]
    │
    ▼ (on error)
notFound         (404 for unmatched routes)
    │
    ▼
errorHandler     (formats HttpError and ZodError into JSON responses)
```

#### Per-route pipeline — `backend/src/modules/opportunities/opportunities.routes.ts`

Each route composes only the handlers it needs:

```ts
router.post(
  "/",
  requireAuth,               // verify JWT, attach req.user
  requireRole("club", "organizer"),  // RBAC guard
  validate(createOpportunitySchema), // Zod validation, rejects with 422
  asyncHandler(async (req, res) => { // actual handler, errors bubble to errorHandler
    const opp = await createOpportunity(req.user!.sub, req.user!.role, req.body);
    res.status(201).json({ opportunity: opp });
  })
);
```

#### Middleware files

| Middleware | File | Responsibility |
|------------|------|----------------|
| `requireAuth` | `backend/src/middleware/auth.ts` | Verify JWT, populate `req.user` |
| `optionalAuth` | `backend/src/middleware/auth.ts` | Populate `req.user` if token present, continue either way |
| `requireRole(...roles)` | `backend/src/middleware/auth.ts` | RBAC — reject if user role not in allowlist |
| `validate(schema, target)` | `backend/src/middleware/validate.ts` | Zod parse `req.body` / `req.query` / `req.params`, reject with ZodError |
| `apiLimiter` | `backend/src/middleware/rateLimit.ts` | express-rate-limit global throttle |
| `requestId` | `backend/src/middleware/requestId.ts` | Attach `X-Request-Id` header |
| `errorHandler` | `backend/src/middleware/errorHandler.ts` | Terminal handler — formats all errors into consistent JSON |
| `notFound` | `backend/src/middleware/notFound.ts` | Catch-all 404 for unmatched routes |

---

## 13. Template Method Pattern

### What it is

Defines the skeleton of an algorithm in a base function, leaving variable steps to be
filled in by subclasses or by caller-provided functions. The template controls the
overall structure (error handling, wrapping); the plugged-in function provides the
domain-specific logic.

### Problem it solves

Every async Express route handler must catch rejected Promises and forward them to
the error middleware via `next(err)`. Without a wrapper, every handler would require
a `try/catch` block or `.catch(next)` call, duplicating the same boilerplate across
every route in every module.

### Implementation

#### `asyncHandler` — `backend/src/utils/async.ts`

```ts
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
```

The template is: `Promise.resolve(fn(...)).catch(next)`.  
The variable step is `fn` — the actual route logic passed in by each caller.

Used in every route handler across all 16+ backend modules:

```ts
// applications.routes.ts
router.post("/:id/apply",
  requireAuth,
  asyncHandler(async (req, res) => {        // ← caller fills in the variable step
    const result = await apply(req.user!.sub, req.params.id, req.body);
    res.status(201).json(result);
  })
);
```

Without `asyncHandler`, each handler would need:

```ts
async (req, res, next) => {
  try {
    // ... logic
  } catch (err) {
    next(err);
  }
}
```

`asyncHandler` eliminates that repetition for every one of the ~60 route handlers in
the backend.

---

## 14. Strategy Pattern

### What it is

Defines a family of interchangeable algorithms, encapsulates each one, and makes them
selectable at runtime. The context does not know which concrete algorithm it runs —
it only calls a common interface. This avoids large `if/else` or `switch` chains
inside business logic.

### Problem it solves

The search service needs to query different Prisma tables with different filter sets
and different ranking rules depending on whether the caller is searching for players,
clubs, or opportunities. Without the Strategy pattern this would be a single large
function with three deeply nested branches.

### Two instances in this codebase

#### Search strategies — `backend/src/modules/search/search.service.ts`

Three separate exported functions, each a distinct strategy for a different entity:

| Strategy function | Entity queried | Filters | Ranking |
|-------------------|---------------|---------|---------|
| `searchPlayers` | `user` (role = athlete) | sport, position, age, availability, experience | `rankPlayers` — verified first, then by `updated_at` |
| `searchClubs` | `organization` | org_type, sport_categories, location | `rankOrgs` — verified first, then by `updated_at` |
| `searchOpportunities` | `opportunity` | type, sport, status, location | deadline proximity |

The frontend `SearchService` selects the strategy at runtime:

```ts
// search.service.ts (frontend)
async search<T>(mode: SearchMode, params: SearchParams): Promise<T[]> {
  const res = await this.client.get<{ items: T[] }>(`/search/${mode}`, { params });
  return res.data.items;
}
```

`mode` is the strategy selector — `"players"`, `"clubs"`, or `"opportunities"`.

#### Ranking strategies — `backend/src/modules/search/search.service.ts`

Two private ranking functions, each embodying a different ranking algorithm:

```ts
function rankPlayers(items: User[]): User[] {
  return items.sort((a, b) => {
    const va = a.verification_status === "approved" ? 1 : 0;
    const vb = b.verification_status === "approved" ? 1 : 0;
    return va !== vb ? vb - va : b.updated_at.getTime() - a.updated_at.getTime();
  });
}

function rankOrgs(items: Organization[]): Organization[] {
  // Same shape, different context — ranks organizations by the same criteria
}
```

Adding a new ranking strategy (e.g. follower count) means adding a new function —
not modifying the existing ones.

---

## 15. Proxy Pattern

### What it is

An object that stands in front of another object to intercept access to it. The Proxy
can add behaviour before and after the real call (logging, validation, caching, retry)
without the caller or the target knowing a proxy is in the middle.

### Two instances in this codebase

#### ES6 `Proxy` in the Decorator implementations

Both `withLogging` and `withRetry` use JavaScript's built-in `Proxy` as the
mechanism to intercept method calls on a service instance:

```ts
// withRetry.ts — simplified
export function withRetry<T extends object>(service: T, options: RetryOptions = {}): T {
  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      return async function (...args: unknown[]) {
        // intercept: add retry logic around the real call
        let attempt = 0;
        while (true) {
          try {
            return await value.apply(target, args);
          } catch (err) {
            if (attempt >= retries || !shouldRetry(err)) throw err;
            await delay(baseDelayMs * Math.pow(2, attempt++));
          }
        }
      };
    },
  });
}
```

Files:
```
frontend/src/services/decorators/withRetry.ts
frontend/src/services/decorators/withLogging.ts
```

The target service class (`PostService`, `OpportunityService`, etc.) has no knowledge
that a Proxy wraps it. The proxy is transparent to both the service and its callers.

#### Axios interceptors — `frontend/src/api/client.ts`

The axios `interceptors` API is itself a Proxy pattern: every outgoing request and
incoming response passes through registered handlers before reaching the caller or
the network:

```ts
// Request interceptor — acts as a proxy that injects the Authorization header
api.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Response interceptor — acts as a proxy that intercepts 401s and transparently
// refreshes the token, then replays the original request
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    if (error.response?.status === 401 && !original._retry) {
      // refresh token, replay request
    }
    return Promise.reject(error);
  }
);
```

Callers use `api.get(...)` normally; the interceptor proxy handles token injection
and session recovery invisibly.

---

## 16. Composite Pattern

### What it is

Treats individual objects and compositions of objects uniformly. A Composite node can
contain leaf nodes or other composites — the caller operates on them all through the
same interface. In React, every component is both a leaf (renders HTML) and a
potential composite (renders other components), and they all share the same interface:
`(props) => JSX`.

### Problem it solves

The application needs to wrap certain routes with authentication checks, role-based
access control, and layout chrome without duplicating that logic in every page
component. The Composite pattern through React's component tree makes this
declarative and composable.

### Two instances in this codebase

#### Route composition — `frontend/src/App.tsx`

`ProtectedRoute` is a composite wrapper. It wraps leaf page components with auth
and RBAC logic:

```tsx
// App.tsx
<Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/opportunities" element={<Opportunities />} />
  <Route
    path="/admin"
    element={<ProtectedRoute roles={["admin"]}><Admin /></ProtectedRoute>}
  />
</Route>
```

`ProtectedRoute` — `frontend/src/components/ProtectedRoute.tsx`:

```tsx
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, accessToken } = useAuthStore();
  if (!user || !accessToken) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}
```

It wraps any child — a page, a layout, another `ProtectedRoute` — without knowing
what that child is.

#### Layout composition — `frontend/src/components/Layout.tsx`

`Layout` is a composite that provides the authenticated app chrome and renders its
child route through `<Outlet />`:

```
Layout (composite)
  ├── <header>   (navigation, search, notifications)
  ├── <aside>    (sidebar with NavItem leaves)
  └── <main>
        └── <Outlet />   (any leaf page component)
```

The `AdaptiveLayout` composite in `App.tsx` chooses between `<Layout>` and
`<PublicLayout>` at runtime, demonstrating how composites can be selected dynamically:

```tsx
function AdaptiveLayout() {
  const user = useAuthStore(s => s.user);
  return user ? <Layout /> : <PublicLayout />;
}
```

---

## 17. Command Pattern

### What it is

Encapsulates a request as a self-contained object that carries everything needed to
execute it: the action (`mutationFn`), pre-execution setup (`onMutate`), success
handling (`onSuccess`), and failure rollback (`onError`). Commands can be queued,
deferred, logged, and undone — the caller does not need to know how to reverse an
operation, only how to trigger it.

### Problem it solves

Without this pattern, every user action that mutates server state needs inline
error handling, cache invalidation logic, and optimistic-update rollback written
directly in the component. This is duplicated for every delete button, every like
button, every form submit. The Command pattern packages all of that into one object.

### Implementation

React Query's `useMutation` hook is the project's command executor. Each mutation
config object is a command definition:

#### Delete a post — `frontend/src/hooks/useFeed.ts`

```ts
// Command definition
const remove = useMutation({
  mutationFn: (id: string) => postService.delete(id),   // execute
  onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }) // post-execute cleanup
});

// Command invocation — the page knows nothing about cache invalidation
<button onClick={() => remove.mutate(postId)}>Delete</button>
```

#### Toggle like with optimistic update and rollback — `frontend/src/hooks/useFeed.ts`

```ts
const toggleLike = useMutation({
  // execute
  mutationFn: (id: string) =>
    likedPosts.has(id) ? postService.unlike(id) : postService.like(id),

  // optimistic pre-execute: flip local state immediately before the server responds
  onMutate: (id: string) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  },

  // undo: if the server rejects, reverse the optimistic flip
  onError: (_err, id) => {
    setLikedPosts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  },

  // post-execute: sync server truth into the cache
  onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
});
```

#### Application status transition — `frontend/src/hooks/useApplications.ts`

```ts
const updateStatus = useMutation({
  mutationFn: ({ id, status, reason }) =>
    applicationService.updateStatus(id, status, reason),   // execute
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: queryKeys.applicants(opportunityId) });
    qc.invalidateQueries({ queryKey: queryKeys.opportunity(opportunityId) });
  },
});

// Caller treats it as a named command — no coupling to cache keys
updateStatus.mutate({ id: appId, status: "shortlisted" });
```

#### Where commands are defined

| Hook file | Commands |
|-----------|---------|
| `hooks/useFeed.ts` | `create`, `update`, `remove`, `toggleLike` |
| `hooks/useOpportunities.ts` | `remove`, `save` |
| `hooks/useApplications.ts` | `withdraw`, `updateStatus` |
| `hooks/useBlogs.ts` | `remove`, `save` |
| `hooks/useComments.ts` | `add`, `update`, `remove` |
| `hooks/useReels.ts` | `toggleLike`, `remove`, `update` |
| `hooks/useNotifications.ts` | `markAllRead` |

---

## 18. Adapter Pattern

### What it is

Converts the interface of one class into a different interface that another class
expects. The Adapter sits between the client and the adaptee, translating calls so
the two incompatible interfaces can work together. This is the structural mechanism
that makes the Repository Pattern work: the Prisma API and the `IXRepository`
interface are different shapes, and the Prisma repository class is the Adapter between
them.

### Problem it solves

Prisma uses its own query API (`findUnique`, `findMany`, `$transaction`, etc.) and
returns Prisma-generated types. The rest of the application expects plain domain
objects and a predictable method set. The Adapter translates between the two so that
services never import `PrismaClient` directly.

### Implementation

Each `PrismaXRepository` class adapts the Prisma API to the matching `IXRepository`
interface:

#### Application adapter — `backend/src/repositories/prisma/PrismaApplicationRepository.ts`

```ts
// Target interface (what the service expects)
export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationRecord | null>;
  create(data: CreateApplicationData): Promise<ApplicationRecord>;
  update(id: string, data: UpdateApplicationData): Promise<ApplicationRecord>;
}

// Adaptee: Prisma — has a completely different API
// prisma.application.findUnique({ where: { id } })
// prisma.$transaction([...])

// Adapter: translates IApplicationRepository calls into Prisma calls
export class PrismaApplicationRepository implements IApplicationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<ApplicationRecord | null> {
    // Adapter translates: findById(id) → prisma.application.findUnique({ where: { id } })
    return this.db.application.findUnique({ where: { id } }) as Promise<ApplicationRecord | null>;
  }

  async create(data: CreateApplicationData): Promise<ApplicationRecord> {
    // Adapter translates: create(data) → prisma.$transaction([create + increment])
    // The service does not know this involves two DB operations
    const [application] = await this.db.$transaction([
      this.db.application.create({ data: { ...data, history: [...] } }),
      this.db.opportunity.update({ where: { id: data.opportunity_id },
                                   data: { application_count: { increment: 1 } } }),
    ]);
    return application as unknown as ApplicationRecord;
  }
}
```

The service calls `repositories.application.create(data)` — one call.  
The Adapter executes a two-step Prisma transaction — the service never knows.

#### All adapter files

```
backend/src/repositories/prisma/PrismaApplicationRepository.ts
backend/src/repositories/prisma/PrismaOpportunityRepository.ts
backend/src/repositories/prisma/PrismaNotificationRepository.ts
backend/src/repositories/prisma/PrismaUserRepository.ts
```

Each adapts: `IXRepository interface` ←→ `Prisma Client API`

#### Frontend Adapter: `scoringClient` — `frontend/src/api/scoringClient.ts`

The scoring subsystem uses a separate backend at a different base URL and port. Rather
than changing how scoring pages make API calls, a second Axios instance adapts the
shared `api` client's auth token into the scoring backend's expected format:

```ts
// scoringClient.ts — adapts the main API client for a different backend
import axios from "axios";
import { useAuthStore } from "../store/auth";

export const scoringApi = axios.create({ baseURL: "/scoring-api" });

scoringApi.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
// Scoring pages call scoringApi.get(...) — identical syntax to api.get(...)
// but the adapter routes requests to a different backend.
```

---

## 19. Module Pattern

### What it is

Groups related code (data, behaviour, configuration) into a self-contained unit with
a defined public interface and private internals. In Node.js, a file is already a
module (CommonJS / ESM), but the pattern goes further: a *feature module* is a
directory that owns all concerns for one domain — routing, business logic, validation
schemas — and exposes only what other modules need through its index.

### Problem it solves

Without the Module pattern, all service functions would sit in a flat `services/`
directory, all routes in a flat `routes/` directory, and all schemas in a flat
`schemas/` directory. Finding everything related to "opportunities" requires searching
three separate trees. With domain modules, adding a new feature means creating one
new directory; removing a feature means deleting one directory.

### Implementation

#### Backend feature modules — `backend/src/modules/`

Each of the 16 backend domains is a self-contained module directory:

```
backend/src/modules/
├── auth/
│   ├── auth.routes.ts     ← public: mounts HTTP endpoints
│   ├── auth.service.ts    ← private: domain logic
│   ├── auth.schemas.ts    ← private: Zod validation shapes
│   └── tokens.ts          ← private: JWT + bcrypt utilities
├── opportunities/
│   ├── opportunities.routes.ts
│   ├── opportunities.service.ts
│   └── opportunities.schemas.ts
├── applications/
│   ├── applications.routes.ts
│   └── applications.service.ts
├── notifications/
│   ├── notifications.routes.ts
│   └── notifications.service.ts
└── … (12 more modules)
```

`app.ts` imports only the route file from each module — the public interface:

```ts
// app.ts — consumes each module through its public surface only
import authRoutes          from "./modules/auth/auth.routes";
import opportunitiesRoutes from "./modules/opportunities/opportunities.routes";
import applicationsRoutes  from "./modules/applications/applications.routes";
// ...

app.use("/api/v1/auth",          authRoutes);
app.use("/api/v1/opportunities", opportunitiesRoutes);
app.use("/api/v1",               applicationsRoutes);
```

No file outside `modules/auth/` imports from `auth.service.ts` directly — it only
reaches auth logic through the route layer. This enforces encapsulation.

#### Frontend feature hooks as modules — `frontend/src/hooks/`

The hooks directory mirrors this on the frontend: each hook file owns the full
query + mutation surface for one domain:

```
frontend/src/hooks/
├── queryKeys.ts          ← shared infrastructure
├── useFeed.ts            ← posts domain module
├── useOpportunities.ts   ← opportunities domain module
├── useApplications.ts    ← applications domain module
├── useBlogs.ts           ← blogs domain module
├── useMessages.ts        ← messaging domain module
├── useNotifications.ts   ← notifications domain module
├── useComments.ts        ← comments domain module
├── useReels.ts           ← reels domain module
└── index.ts              ← barrel: public interface for all hook modules
```

Pages import from the barrel — they never reach into individual hook internals:

```ts
// Correct — importing through the module's public interface
import { useFeed, useOpportunities, useMyApplications } from "../hooks";

// Wrong — bypassing module encapsulation (never done in this codebase)
import { useFeed } from "../hooks/useFeed";
```

#### Config as modules — `backend/src/config/`

Infrastructure concerns are also modularised. Each config file is a singleton
module with a single exported concern:

```
backend/src/config/
├── env.ts       ← validated environment variables
├── prisma.ts    ← database client
├── logger.ts    ← structured logging
├── mailer.ts    ← email transport
├── storage.ts   ← Google Cloud Storage
└── openai.ts    ← AI client
```

This means adding a new infrastructure dependency (Redis, S3) is a new file in
`config/` — not a change to an existing file.

---

## File Index

### Backend

| Pattern | Files |
|---------|-------|
| State Machine | `backend/src/lib/StateMachine.ts` |
| | `backend/src/workflows/applicationWorkflow.ts` |
| | `backend/src/workflows/opportunityWorkflow.ts` |
| | `backend/src/modules/applications/applications.service.ts` |
| Event Bus | `backend/src/lib/EventBus.ts` |
| | `backend/src/events/types.ts` |
| | `backend/src/events/handlers/notificationHandler.ts` |
| | `backend/src/events/bootstrap.ts` |
| | `backend/src/app.ts` (bootstrap call) |
| | `backend/src/modules/follow/follow.service.ts` |
| | `backend/src/modules/messaging/messaging.service.ts` |
| Repository | `backend/src/repositories/interfaces/IApplicationRepository.ts` |
| | `backend/src/repositories/interfaces/IOpportunityRepository.ts` |
| | `backend/src/repositories/interfaces/INotificationRepository.ts` |
| | `backend/src/repositories/interfaces/IUserRepository.ts` |
| | `backend/src/repositories/prisma/PrismaApplicationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaOpportunityRepository.ts` |
| | `backend/src/repositories/prisma/PrismaNotificationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaUserRepository.ts` |
| | `backend/src/repositories/index.ts` |
| | `backend/src/modules/notifications/notifications.service.ts` |
| Factory | `backend/src/utils/errors.ts` (error factories) |
| | `backend/src/app.ts` (createApp) |
| Singleton | `backend/src/config/prisma.ts` |
| | `backend/src/config/logger.ts` |
| | `backend/src/lib/EventBus.ts` |
| | `backend/src/config/env.ts` |
| Chain of Responsibility | `backend/src/app.ts` (global pipeline) |
| | `backend/src/middleware/auth.ts` |
| | `backend/src/middleware/validate.ts` |
| | `backend/src/middleware/rateLimit.ts` |
| | `backend/src/middleware/requestId.ts` |
| | `backend/src/middleware/errorHandler.ts` |
| | `backend/src/middleware/notFound.ts` |
| Template Method | `backend/src/utils/async.ts` (asyncHandler) |
| | All `*.routes.ts` files (consumers) |
| Strategy | `backend/src/modules/search/search.service.ts` |
| Command | All mutation definitions in `backend/src/modules/*/` route handlers |
| Adapter | `backend/src/repositories/prisma/PrismaApplicationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaOpportunityRepository.ts` |
| | `backend/src/repositories/prisma/PrismaNotificationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaUserRepository.ts` |
| Module | `backend/src/modules/` (all 16 domain module directories) |
| | `backend/src/config/` (env, prisma, logger, mailer, storage, openai) |

### Frontend

| Pattern | Files |
|---------|-------|
| Service Layer + DI | `frontend/src/services/post.service.ts` |
| | `frontend/src/services/opportunity.service.ts` |
| | `frontend/src/services/application.service.ts` |
| | `frontend/src/services/blog.service.ts` |
| | `frontend/src/services/comment.service.ts` |
| | `frontend/src/services/message.service.ts` |
| | `frontend/src/services/notification.service.ts` |
| | `frontend/src/services/user.service.ts` |
| | `frontend/src/services/auth.service.ts` |
| | `frontend/src/services/organization.service.ts` |
| | `frontend/src/services/reel.service.ts` |
| | `frontend/src/services/search.service.ts` |
| | `frontend/src/services/index.ts` |
| Decorator | `frontend/src/services/decorators/withLogging.ts` |
| | `frontend/src/services/decorators/withRetry.ts` |
| | `frontend/src/services/index.ts` (composition via build()) |
| Custom Hook | `frontend/src/hooks/useFeed.ts` |
| | `frontend/src/hooks/useOpportunities.ts` |
| | `frontend/src/hooks/useApplications.ts` |
| | `frontend/src/hooks/useBlogs.ts` |
| | `frontend/src/hooks/useMessages.ts` |
| | `frontend/src/hooks/useNotifications.ts` |
| | `frontend/src/hooks/useComments.ts` |
| | `frontend/src/hooks/useReels.ts` |
| | `frontend/src/hooks/index.ts` |
| Query Key Factory | `frontend/src/hooks/queryKeys.ts` |
| Facade | All 12 service class files (same as Service Layer) |
| Model Separation | `frontend/src/models/user.model.ts` |
| | `frontend/src/models/organization.model.ts` |
| | `frontend/src/models/opportunity.model.ts` |
| | `frontend/src/models/application.model.ts` |
| | `frontend/src/models/post.model.ts` |
| | `frontend/src/models/reel.model.ts` |
| | `frontend/src/models/blog.model.ts` |
| | `frontend/src/models/notification.model.ts` |
| | `frontend/src/models/comment.model.ts` |
| | `frontend/src/models/message.model.ts` |
| | `frontend/src/models/index.ts` |
| | `frontend/src/types.ts` (backward-compat shim) |
| Factory | `frontend/src/services/index.ts` (build() helper) |
| Singleton | `frontend/src/api/client.ts` (api instance) |
| | `frontend/src/services/index.ts` (all 12 service instances) |
| | `frontend/src/store/auth.ts` |
| | `frontend/src/store/savedOpportunities.ts` |
| | `frontend/src/store/favorites.ts` |
| Proxy | `frontend/src/services/decorators/withRetry.ts` |
| | `frontend/src/services/decorators/withLogging.ts` |
| | `frontend/src/api/client.ts` (axios interceptors) |
| Strategy | `frontend/src/services/search.service.ts` (SearchMode selector) |
| Composite | `frontend/src/components/ProtectedRoute.tsx` |
| | `frontend/src/components/Layout.tsx` |
| | `frontend/src/App.tsx` (AdaptiveLayout, route tree) |
| Command | `frontend/src/hooks/useFeed.ts` (create, update, remove, toggleLike) |
| | `frontend/src/hooks/useOpportunities.ts` (remove, save) |
| | `frontend/src/hooks/useApplications.ts` (withdraw, updateStatus) |
| | `frontend/src/hooks/useBlogs.ts` (remove, save) |
| | `frontend/src/hooks/useComments.ts` (add, update, remove) |
| | `frontend/src/hooks/useReels.ts` (toggleLike, remove, update) |
| | `frontend/src/hooks/useNotifications.ts` (markAllRead) |
| Adapter | `frontend/src/api/scoringClient.ts` |
| Module | `frontend/src/hooks/` (each hook file = one domain module) |
| | `frontend/src/hooks/index.ts` (barrel / public interface) |

| Pattern | Files |
|---------|-------|
| State Machine | `backend/src/lib/StateMachine.ts` |
| | `backend/src/workflows/applicationWorkflow.ts` |
| | `backend/src/workflows/opportunityWorkflow.ts` |
| | `backend/src/modules/applications/applications.service.ts` |
| Event Bus | `backend/src/lib/EventBus.ts` |
| | `backend/src/events/types.ts` |
| | `backend/src/events/handlers/notificationHandler.ts` |
| | `backend/src/events/bootstrap.ts` |
| | `backend/src/app.ts` (bootstrap call) |
| | `backend/src/modules/follow/follow.service.ts` |
| | `backend/src/modules/messaging/messaging.service.ts` |
| Repository | `backend/src/repositories/interfaces/IApplicationRepository.ts` |
| | `backend/src/repositories/interfaces/IOpportunityRepository.ts` |
| | `backend/src/repositories/interfaces/INotificationRepository.ts` |
| | `backend/src/repositories/interfaces/IUserRepository.ts` |
| | `backend/src/repositories/prisma/PrismaApplicationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaOpportunityRepository.ts` |
| | `backend/src/repositories/prisma/PrismaNotificationRepository.ts` |
| | `backend/src/repositories/prisma/PrismaUserRepository.ts` |
| | `backend/src/repositories/index.ts` |
| | `backend/src/modules/notifications/notifications.service.ts` |

### Frontend

| Pattern | Files |
|---------|-------|
| Service Layer + DI | `frontend/src/services/post.service.ts` |
| | `frontend/src/services/opportunity.service.ts` |
| | `frontend/src/services/application.service.ts` |
| | `frontend/src/services/blog.service.ts` |
| | `frontend/src/services/comment.service.ts` |
| | `frontend/src/services/message.service.ts` |
| | `frontend/src/services/notification.service.ts` |
| | `frontend/src/services/user.service.ts` |
| | `frontend/src/services/auth.service.ts` |
| | `frontend/src/services/organization.service.ts` |
| | `frontend/src/services/reel.service.ts` |
| | `frontend/src/services/search.service.ts` |
| | `frontend/src/services/index.ts` |
| Decorator | `frontend/src/services/decorators/withLogging.ts` |
| | `frontend/src/services/decorators/withRetry.ts` |
| | `frontend/src/services/index.ts` (composition) |
| Custom Hook | `frontend/src/hooks/useFeed.ts` |
| | `frontend/src/hooks/useOpportunities.ts` |
| | `frontend/src/hooks/useApplications.ts` |
| | `frontend/src/hooks/useBlogs.ts` |
| | `frontend/src/hooks/useMessages.ts` |
| | `frontend/src/hooks/useNotifications.ts` |
| | `frontend/src/hooks/useComments.ts` |
| | `frontend/src/hooks/useReels.ts` |
| | `frontend/src/hooks/index.ts` |
| Query Key Factory | `frontend/src/hooks/queryKeys.ts` |
| Facade | All 12 service classes (same as Service Layer) |
| Model Separation | `frontend/src/models/user.model.ts` |
| | `frontend/src/models/organization.model.ts` |
| | `frontend/src/models/opportunity.model.ts` |
| | `frontend/src/models/application.model.ts` |
| | `frontend/src/models/post.model.ts` |
| | `frontend/src/models/reel.model.ts` |
| | `frontend/src/models/blog.model.ts` |
| | `frontend/src/models/notification.model.ts` |
| | `frontend/src/models/comment.model.ts` |
| | `frontend/src/models/message.model.ts` |
| | `frontend/src/models/index.ts` |
| | `frontend/src/types.ts` (backward-compat shim) |
