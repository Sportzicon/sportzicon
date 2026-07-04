# Sportzicon — Sports Recruitment & Networking Platform

A multi-role sports recruitment platform for the Indian sports market. Athletes discover and apply to opportunities. Clubs post trials and recruit verified talent. Scouts search and shortlist players. Organizers manage tournaments. The entire ecosystem runs under a unified verified identity framework with a dedicated cricket scoring console.

> **Production:** GCP Cloud Run · PostgreSQL (Supabase) · Google Cloud Storage  
> **Owner:** EASOPS Technologies PVT LTD — Strictly Confidential

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Quick Start (Local)](#quick-start-local)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Design Patterns](#design-patterns)
- [Testing](#testing)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### By Role

| Role | Capabilities |
|------|-------------|
| **Athlete** | Verified profile with sport stats, upload media/reels, apply to opportunities, AI performance tips, follow network, cricket stats integration |
| **Club / Academy** | Post trials/scholarships/tournaments, manage application pipeline (pending → shortlisted → selected), search athletes, message candidates |
| **Scout** | Advanced athlete search (sport, level, availability, location, age), follow profiles, message athletes, shortlist via opportunities |
| **Organizer** | Post events, manage scoring console, create and manage tournament brackets |
| **Admin** | User moderation, identity verification review, badge issuance, abuse reports, full audit log, platform analytics |
| **Scorer** | Live ball-by-ball scoring console, innings management, match XI configuration, retired-hurt tracking |

### Platform Features

- **Auth:** Multi-role JWT authentication with 15-minute access tokens and 30-day rotating refresh tokens. Email verification, password reset.
- **Profiles:** Rich athlete profiles with sport-specific stats, career history, achievements, document uploads, follow/follower network.
- **Opportunities:** Full listings for trials, recruitment, scholarships, tournaments, coaching jobs — with eligibility filtering (age, gender, experience), vacancy tracking, and deadline enforcement.
- **Application workflow:** Structured state machine — Pending → Shortlisted → Selected / Rejected / Withdrawn — with automatic vacancy management and email notifications on every transition.
- **Social feed:** Training logs and updates with likes, comments, and a personalised follow-graph feed.
- **Reels:** Short video highlights, Instagram-style feed with view tracking and likes.
- **Blogs:** Long-form markdown articles with draft/publish workflow, cover images, tags, and view counts.
- **Messaging:** 1:1 conversation threads with unread count tracking.
- **Notifications:** In-app and email notifications for applications, follows, messages, and verification events.
- **Search:** Multi-entity full-text search — players, clubs, and opportunities — with 10+ filterable attributes.
- **Verification:** Admin-controlled badge issuance with document review workflow.
- **Media:** GCS-backed uploads with signed URLs for private documents and public CDN for media.
- **AI tips:** OpenAI GPT-4o-mini powered athlete performance recommendations (rate-limited, 20/day).
- **Cricket scoring:** Dedicated scoring console with tournament management, live ball-by-ball entry, innings analytics, and partnerships.

---

## Architecture

The platform is a monorepo containing three independently deployable services:

```
Browser ──► React SPA (Vite)
                │
                ├── /api/v1/*      ──► Main API (Express + Node.js 20)
                │                          │
                │                          ├── PostgreSQL (Supabase)
                │                          ├── Google Cloud Storage
                │                          ├── OpenAI API
                │                          └── Email (Gmail/Resend)
                │
                └── /scoring-api/* ──► Scoring Backend (Express + Node.js)
                                            │
                                            └── Scoring PostgreSQL (Docker)
```

---

## Technology Stack

### Backend

| Technology | Version | Role |
|------------|---------|------|
| Node.js | 20 LTS | Runtime |
| TypeScript | 5.x | Language |
| Express | 4.x | HTTP framework |
| Prisma ORM | 5.x | Database client + migrations |
| PostgreSQL | 15/16 | Primary datastore (Supabase) |
| Zod | 3.x | Runtime validation + type generation |
| JWT (jsonwebtoken) | — | Stateless authentication |
| bcryptjs | — | Password hashing (12 rounds) |
| Pino | 9.x | Structured JSON logging |

### Frontend

| Technology | Version | Role |
|------------|---------|------|
| React | 18 | UI framework |
| Vite | 5 | Build tool + dev server |
| TypeScript | 5.x | Language |
| TanStack React Query | 5 | Server state management |
| Zustand | 4 | Client state (auth, saved items) |
| Tailwind CSS | 3 | Utility-first styling |
| react-hook-form + Zod | — | Form validation |
| React Router | 6 | Client-side routing |

### Infrastructure

| Technology | Role |
|------------|------|
| Docker / Docker Compose | Local development environment |
| GCP Cloud Run | Serverless container hosting |
| Supabase | Managed PostgreSQL + connection pooling |
| Google Cloud Storage | Media uploads + private documents |
| Terraform | Infrastructure as code (`infra/terraform/`) |
| GitHub Actions | CI: typecheck, build, test |
| Google Cloud Build | CD: image build → Artifact Registry → Cloud Run deploy |

---

## Project Structure

```
sportivox-main/
├── backend/                    Main Node.js API
│   └── src/
│       ├── config/             Singletons: prisma, logger, mailer, storage, openai, env
│       ├── events/             Domain event types, handlers, bootstrap
│       │   └── handlers/
│       ├── lib/                StateMachine, EventBus
│       ├── middleware/         auth, validate, rateLimit, errorHandler, requestId
│       ├── modules/            16 feature modules (routes + service + schemas each)
│       │   ├── auth/
│       │   ├── users/
│       │   ├── organizations/
│       │   ├── opportunities/
│       │   ├── applications/
│       │   ├── posts/          posts.service + comments.service (split)
│       │   ├── reels/
│       │   ├── blogs/
│       │   ├── follow/
│       │   ├── messaging/
│       │   ├── notifications/
│       │   ├── search/
│       │   ├── media/
│       │   ├── ai/
│       │   ├── verification/
│       │   ├── admin/
│       │   └── email-logs/
│       ├── repositories/       Repository interfaces + Prisma implementations
│       │   ├── interfaces/
│       │   └── prisma/
│       ├── types/              Domain enums (Role, ApplicationStatus, etc.)
│       ├── utils/              errors, async, ids, user, org helpers
│       ├── workflows/          applicationWorkflow, opportunityWorkflow (FSM definitions)
│       ├── app.ts              Express app factory
│       └── server.ts           HTTP server startup + graceful shutdown
│
├── frontend/                   React SPA
│   └── src/
│       ├── api/                Axios client (with token refresh) + scoringClient
│       ├── components/         Layout, ProtectedRoute, CommentSection, UI primitives
│       ├── hooks/              9 custom hooks + queryKeys factory
│       ├── models/             10 TypeScript interface files (DTOs)
│       ├── pages/              40+ route-level page components
│       │   ├── admin/
│       │   └── scoring/
│       ├── services/           12 service classes + decorators (withRetry, withLogging)
│       │   └── decorators/
│       ├── store/              Zustand stores: auth, scoringAuth, savedOpportunities, favorites
│       ├── data/               Static data: geo, cricket enums
│       └── types.ts            Backward-compat re-export shim → models/
│
├── scoring/                    Cricket scoring subsystem (separate service)
│   ├── backend/                Node.js + Express API (port 4000, own DB)
│   └── frontend/               React app (proxied under /scoring-api)
│
├── database/
│   └── prisma/
│       └── schema.prisma       Single source of truth for main DB schema
│
├── infra/                      Terraform IaC + Cloud Build config
├── e2e/                        End-to-end tests
├── scripts/                    Utility scripts
├── docker-compose.yml          Local dev stack
├── Makefile                    Developer task shortcuts
└── package.json                Monorepo root
```

---

## Quick Start (Local)

### Prerequisites

- Docker and Docker Compose
- Node.js 20+
- A `.env` file in `backend/` (copy from `.env.example`)

### Start everything

```bash
# Install all dependencies (backend + frontend)
make install

# Start the full local stack
# Spins up: main API (8080), React SPA (5173), scoring backend, GCS emulator
make dev
```

Open [http://localhost:5173](http://localhost:5173).

### Demo accounts

Sign in with password `Demo1234!`:

| Email | Role |
|-------|------|
| `admin@sportivox.local` | Admin |
| `athlete@demo.sportivox` | Athlete |
| `club@demo.sportivox` | Club |
| `scout@demo.sportivox` | Scout |

### Load demo data

```bash
make seed    # Creates demo users, an organization, and sample opportunities
```

### Start services individually

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Scoring backend only
cd scoring/backend && npm run dev
```

---

## Environment Variables

### Main Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:5432/postgres

# Auth
JWT_ACCESS_SECRET=change-me-min-32-chars
JWT_REFRESH_SECRET=change-me-min-32-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
BCRYPT_ROUNDS=12

# Server
PORT=8080
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173

# Google Cloud Storage
GCP_PROJECT_ID=your-project
GCS_BUCKET_MEDIA=your-media-bucket
GCS_BUCKET_DOCS=your-docs-bucket
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Email (choose one)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=app-password

# OpenAI (optional — AI tips disabled if absent)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
AUTH_RATE_LIMIT_MAX=20

# Bootstrap (first run only)
BOOTSTRAP_ADMIN_EMAIL=admin@yourplatform.com
BOOTSTRAP_ADMIN_PASSWORD=SecurePassword123!
```

---

## Database

### Schema management

The main database schema lives in `database/prisma/schema.prisma`. Prisma Migrate manages all changes.

```bash
# Apply pending migrations to the database
cd backend && npx prisma migrate deploy

# Create a new migration after schema changes
cd backend && npx prisma migrate dev --name describe_your_change

# Open Prisma Studio (GUI)
cd backend && npx prisma studio
```

### Scoring database

The scoring subsystem has its own Prisma schema at `scoring/backend/prisma/schema.prisma`. It is managed independently and runs against a dedicated PostgreSQL instance.

```bash
cd scoring/backend && npx prisma db push   # apply schema (dev only)
cd scoring/backend && npx prisma migrate deploy   # production
```

---

## Design Patterns

The codebase implements 19 named design patterns across both layers.

**Backend patterns:**

| Pattern | Where |
|---------|-------|
| State Machine | `lib/StateMachine.ts` — application and opportunity workflows |
| Observer / Event Bus | `lib/EventBus.ts` — decoupled notification dispatch |
| Repository | `repositories/` — 4 interfaces + Prisma implementations |
| Factory | `utils/errors.ts` (`BadRequest`, `NotFound`, etc.), `app.ts` (`createApp`) |
| Singleton | `config/prisma`, `config/logger`, `lib/EventBus` |
| Chain of Responsibility | Express middleware pipeline per route |
| Template Method | `utils/async.ts` (`asyncHandler`) |
| Strategy | `modules/search/search.service.ts` (player/club/opportunity strategies) |
| Module | 16 self-contained domain modules in `modules/` |
| Adapter | Prisma repository implementations adapt Prisma API to IRepository interfaces |

**Frontend patterns:**

| Pattern | Where |
|---------|-------|
| Service Layer + DI | `services/` — 13 classes with injected AxiosInstance |
| Decorator | `services/decorators/withRetry.ts` + `withLogging.ts` |
| Custom Hook | `hooks/` — 9 domain hooks encapsulating React Query logic |
| Query Key Factory | `hooks/queryKeys.ts` — single source for all cache keys |
| Facade | All service classes hide HTTP complexity |
| Model Separation (DTO) | `models/` — 10 interface files, no behaviour |
| Singleton | Service instances, Zustand stores, axios client |
| Proxy | ES6 `Proxy` inside `withRetry` and `withLogging` |
| Composite | `ProtectedRoute`, `Layout`, route tree in `App.tsx` |
| Command | React Query `useMutation` — execute + rollback + cleanup |

---

## Testing

```bash
# Run all tests (backend + frontend)
make test

# Backend only (Jest + Supertest)
cd backend && npm test

# Frontend only (Vitest)
cd frontend && npm test

# With coverage
cd backend && npm run test:coverage
```

Backend tests connect to a test PostgreSQL database. The `DATABASE_URL` for testing should point to a separate database or use a test schema.

---

## Deployment

### Production deployment (GCP Cloud Run)

**Step 1 — Build and push container images:**

```bash
gcloud builds submit . --config infra/cloudbuild.yaml \
  --substitutions=\
_REGION=asia-south1,\
_AR_REPO=sportivox,\
_API_SERVICE=sportivox-api-prod,\
_WEB_SERVICE=sportivox-web-prod,\
_API_PUBLIC_URL=https://api.yourdomain.com,\
_WEB_APP_URL=https://yourdomain.com
```

**Step 2 — Provision infrastructure with Terraform:**

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your GCP project, region, and domain
terraform init
terraform plan
terraform apply
```

This creates:
- Cloud Run services (`sportivox-api`, `sportivox-web`)
- GCS buckets (`sportivox-media`, `sportivox-docs`)
- Secret Manager secrets for all sensitive env vars
- Artifact Registry repository
- IAM service accounts with least-privilege roles

**CI/CD (automatic after initial setup):**

```
git push → GitHub Actions (typecheck + test) → Cloud Build → Cloud Run
```

---

## Security

Key controls:

| Control | Implementation |
|---------|---------------|
| Password storage | bcrypt, 12 salt rounds, never logged |
| Access tokens | JWT, 15-minute lifetime, signed with `RS256`-strength secret |
| Refresh tokens | 30-day, single-use, server-revocable, stored hashed in DB |
| Transport | HTTPS enforced (Cloud Run HTTPS-only redirect) |
| Security headers | Helmet.js (HSTS, X-Frame-Options, X-Content-Type-Options, etc.) |
| CORS | Origin allowlist, credentials: false |
| Rate limiting | 300 req/15min global, 20 req/15min on `/auth/*` per IP |
| Input validation | Zod schema on every endpoint — body, query, params |
| RBAC | Role embedded in JWT; `requireRole` middleware on every protected route |
| Private documents | GCS signed URLs with 15-minute TTL |
| Audit trail | All admin actions logged to `AuditLog` table with actor, IP, timestamp |
| Log redaction | Passwords, tokens, authorization headers stripped from all log output |

---

## Contributing

### Branch strategy

- `main` — production-ready code, deployed automatically
- Feature branches — `feature/short-description`, PR into `main`
- Hotfixes — `fix/short-description`, PR into `main`

### Before opening a PR

```bash
make install         # ensure deps are current
make dev             # verify the stack starts
make test            # all tests must pass
cd backend && npx tsc --noEmit     # no type errors
cd frontend && npx tsc --noEmit    # no type errors
```

### Commit style

```
type(scope): short description

feat(opportunities): add vacancy auto-close on deadline
fix(auth): handle concurrent 401 refresh race condition
refactor(posts): extract comment logic to comments.service
docs(designs): add architectural-flaws register
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

---

## License

Proprietary — © Sportivox / EASOPS Technologies PVT LTD.  
All rights reserved. Strictly Confidential. Unauthorized use, reproduction, or distribution is prohibited.
