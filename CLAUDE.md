# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

### Full stack (preferred)
```bash
make dev          # docker compose up --build — starts everything
make test         # backend Jest + frontend Vitest
make build        # tsc (backend) + vite build (frontend)
make lint         # eslint both
make seed         # seed demo accounts (athlete, club, scout, admin) into main DB
```

### Backend only (`cd backend`)
```bash
npm run dev       # tsx watch — hot-reload dev server on :8080
npm run build     # tsc compile to dist/
npm test          # Jest, runs --runInBand --forceExit
npm run typecheck # tsc --noEmit only
npm run lint
```

### Run a single backend test file
```bash
cd backend && npm test -- --testPathPattern="auth"
cd backend && npm test -- --testPathPattern="opportunities" --verbose
```

> Backend integration tests require `DATABASE_URL` to contain `localhost` or `test`. They will refuse to run against the cloud Supabase URL — this is an intentional safety guard in `tests/helpers/setup.ts`.

### Frontend only (`cd frontend`)
```bash
npm run dev       # Vite on :5173 with HMR
npm run build     # tsc --noEmit + vite build
npm test          # Vitest --run (single pass)
npm run test:watch
npm run typecheck # tsc --noEmit
```

### Scoring backend (`cd scoring/backend`)
```bash
npm run dev        # ts-node-dev hot-reload on :4000
npm run build      # tsc compile to dist/
npm run db:seed    # seed scoring demo admin account
npm run db:push    # push schema without migrations (dev only)
npm run db:migrate # prisma migrate dev
npm run db:studio  # Prisma Studio GUI
```

### Scoring frontend (`cd scoring/frontend`)
```bash
npm run dev        # Vite on :5174 (port is fixed in vite.config.ts)
npm run build
```

### Database (run from `backend/`)
```bash
npx prisma migrate dev --name describe_change  # create + apply migration
npx prisma migrate deploy                       # apply pending (production)
npx prisma studio                               # GUI browser
npx prisma generate                             # regenerate client after schema change
```

The main schema is at `database/prisma/schema.prisma` (not `backend/`). The scoring subsystem has its own schema at `scoring/backend/prisma/schema.prisma`.

### E2E tests (`cd e2e`)

Install frontend deps first — the Playwright `webServer` config auto-starts both Vite dev servers but requires `node_modules` to exist in `frontend/` and `scoring/frontend/`.

```bash
# Install deps for both frontends (one-time, or after package changes)
(cd ../frontend && npm install) && (cd ../scoring/frontend && npm install)

npm test                       # all tests (Playwright starts Vite servers automatically)
npm run test:smoke             # @smoke tagged only
npm run test:critical          # @critical tagged
npm run test:auth              # @auth tagged
npm run test:scoring           # @scoring tagged

# Single spec file
npx playwright test tests/sportivox/landing.spec.ts
npx playwright test tests/scoring/live-scoring.spec.ts

# Debug / headed
npm run test:headed
npm run test:debug             # PWDEBUG=1
npm run test:ui                # Playwright UI mode

# View last report
npm run report
```

Tests that depend on backend API or seed data skip gracefully when the service is unreachable — never hard-fail. Tests that need seeded accounts expect `SVOX_DEMO_PASSWORD` (default `Demo1234!`) set before `make seed` was run.

---

## Architecture

### Monorepo layout

```
backend/      Main Node.js + Express API (port 8080)
frontend/     React 18 + Vite SPA (port 5173 dev)
scoring/      Standalone cricket scoring service
  backend/      Node.js + Express (port 4000, own PostgreSQL)
  frontend/     React app (port 5174), auth via SSO with main app
database/     Single Prisma schema for the main backend
e2e/          Playwright suite covering both SPAs
designs/      Architecture docs — read these before large changes
infra/        Terraform for GCP Cloud Run deployment
```

### Backend module system

Every feature lives in `backend/src/modules/<name>/` with three files:
- `<name>.routes.ts` — Express Router, middleware composition, `asyncHandler` wrappers
- `<name>.service.ts` — business logic, calls repositories and emits events
- `<name>.schemas.ts` — Zod schemas (if present)

Adding a new module: create the directory, then register the router in `backend/src/app.ts`.

**16 modules:** auth, users, organizations, opportunities, applications, posts, reels, blogs, follow, messaging, notifications, search, media, ai, verification, admin, email-logs.

`posts/` has a split: `posts.service.ts` (post CRUD + feed + likes) and `comments.service.ts` (comments for posts, reels, and blogs — all parent types).

### Key backend infrastructure

**`lib/StateMachine.ts`** — Generic FSM used in `applications.service.ts`. Workflow transitions and per-state side-effect listeners are defined in `workflows/applicationWorkflow.ts` and `workflows/opportunityWorkflow.ts`. Never add status-transition logic directly into service functions — register listeners on the machine instead.

**`lib/EventBus.ts`** — Singleton fire-and-forget event bus. Services call `eventBus.emit(EVENT_NAME, payload)` — do **not** await it. Handlers are registered in `events/handlers/notificationHandler.ts` and wired at startup via `events/bootstrap.ts` → `app.ts`. To add a new cross-cutting side-effect (push notification, analytics), add a handler in `events/handlers/` and call `eventBus.on(...)` inside `registerNotificationHandlers()`.

**`repositories/`** — Interface + Prisma implementation pairs for Application, Opportunity, Notification, User. Service functions import `repositories` from `repositories/index.ts` — never import `prisma` directly in these four modules. The remaining 12 modules still import `prisma` directly (known gap, see `designs/architectural-flaws.md` ARCH-006).

**`middleware/`** — Every protected route uses the chain: `requireAuth` → optionally `requireRole(...roles)` → `validate(zodSchema)` → `asyncHandler(async fn)`. `asyncHandler` is mandatory on async handlers; without it, unhandled rejections bypass the error middleware.

**`config/env.ts`** — Zod-validated environment config. The process exits immediately if any required variable is missing or invalid. All other config singletons (`prisma`, `logger`, `storage`, `mailer`, `openai`) import from here.

### Frontend layer model

Data flows strictly downward through four layers. Never skip a layer:

```
pages/         → consume hooks only; no useQuery/useMutation/api calls
hooks/         → wrap services in useQuery/useMutation; own cache invalidation
services/      → typed methods over axios; one class per domain
models/        → pure TypeScript interfaces (no behaviour)
```

**`hooks/queryKeys.ts`** — The only allowed source of React Query cache keys. Every `useQuery`, `useMutation.onSuccess` invalidation, and `useQueryClient().invalidateQueries` call must reference `queryKeys.*`. Adding a raw string array is a bug.

**`services/index.ts`** — DI wiring point. All 13 service singletons are constructed here via `build(new XService(api), "XService")` which applies `withRetry` + `withLogging` decorators. This is the only file that imports `api` or `scoringApi` and passes them to services.

**`frontend/src/types.ts`** — Backward-compatibility re-export shim only. New code imports from `../models` or `../models/x.model`.

**Zustand stores** — `store/auth.ts` (main session), `store/scoringAuth.ts` (scoring JWT — separate because the scoring backend issues its own tokens via SSO), `store/savedOpportunities.ts`, `store/favorites.ts`. The scoring store's auth field is named `scoringUser`, not `user`.

**Routing / layouts** — Three layout components:
- `Layout` — authenticated shell (sidebar, nav)
- `PublicLayout` — unauthenticated shell
- `AdaptiveLayout` — picks the correct one based on `useAuthStore`

`ProtectedRoute` guards all authenticated pages.

### Scoring subsystem bridge

The scoring backend is a completely separate Node.js service with its own PostgreSQL. The main frontend reaches it via Vite proxy (`/scoring-api → :4000`). Authentication works in two modes:

1. **Public read** (live scores pages): `scoringApi` axios instance reads the main Sportivox JWT from `useAuthStore` and passes it as Bearer token — scoring backend validates it against `MAIN_JWT_SECRET`.
2. **Scorer write** (console pages): `ScoringGate.tsx` exchanges the main JWT for a scoring-specific JWT via `POST /scoring-api/api/auth/sso`. The scoring JWT is stored in `useScoringAuthStore`.

`ScoringService` (in `services/scoring.service.ts`) wraps all `scoringApi` calls through the same Service Layer pattern as every other service.

The scoring console SPA (port 5174) persists auth to `localStorage` under key `scoring-auth` as a Zustand persist store. Playwright E2E tests bypass the login UI by injecting auth directly into localStorage via `page.addInitScript`.

### Error handling conventions

**Backend:** Throw `BadRequest(msg)`, `NotFound(msg)`, `Forbidden(msg)` etc. from `utils/errors.ts`. These factory functions return `HttpError` instances that the global error handler formats into consistent JSON. Never return error responses directly from route handlers.

**Frontend:** Use `humanizeError(err)` from `api/client.ts` to turn any axios error (including Zod field errors from the backend) into a single user-facing string. The backend guarantees `{ error: { code, message, details? } }` shape on every non-2xx response.

### E2E test structure

Tests in `e2e/tests/sportivox/` cover the main app; `e2e/tests/scoring/` cover the scoring console. The `webServer` config in `playwright.config.ts` starts the appropriate Vite server only when the target URL is localhost — when staging secrets are set (`SVOX_STAGING_URL`, `SCORING_STAGING_URL`), servers are not started.

`e2e/tests/_helpers/labels.ts` provides `fieldByLabel` and `inputByType` to locate inputs in the scoring app's forms, which use un-linked `<label>Text</label><input>` sibling pairs (no `for`/`id`).

User roles in demo seed: `athlete@demo.sportivox`, `club@demo.sportivox`, `scout@demo.sportivox`, `admin@sportivox.local`. Scoring admin: `admin@scoring.local`. All use password `Demo1234!` by default.

### CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | push / PR → main | Type-check backend, build frontend |
| `daily-e2e.yml` | daily 03:00 UTC, or on e2e/ changes | Playwright tests; commits summary to `reports/e2e/`; updates GitHub issue labeled `e2e` |
| `deploy-staging.yml` | push → main | Docker build → GCP Cloud Run (staging) |
| `deploy-production.yml` | git tag `v*` | Docker build → GCP Cloud Run (production) + GitHub Release |

### Adding a new API endpoint (checklist)

1. Add Zod schema to `modules/<name>/<name>.schemas.ts`
2. Add service function to `modules/<name>/<name>.service.ts` (use `repositories.*` for the four covered domains; use `prisma` directly otherwise)
3. Add route to `modules/<name>/<name>.routes.ts` using the middleware chain pattern
4. If the operation should notify another user, `eventBus.emit(EVENT_NAME, payload)` — add a new event type to `events/types.ts` if needed, and a handler in `events/handlers/`
5. Add a matching method to the frontend service class in `services/<name>.service.ts`
6. Add or update a custom hook in `hooks/use<Name>.ts` using `queryKeys.*`
7. Update `hooks/queryKeys.ts` if a new cache key is needed
