# High-Level Design — Sportivox / Sportzicon

**Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Current  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Context](#2-system-context)
3. [Component Overview](#3-component-overview)
4. [Technology Decisions and Rationale](#4-technology-decisions-and-rationale)
5. [External Service Integrations](#5-external-service-integrations)
6. [Security Architecture Overview](#6-security-architecture-overview)
7. [Deployment Architecture](#7-deployment-architecture)
8. [Data Storage Strategy](#8-data-storage-strategy)
9. [Scalability Considerations](#9-scalability-considerations)
10. [C4 Level 1 — System Context Diagram](#10-c4-level-1--system-context-diagram)
11. [C4 Level 2 — Container Diagram](#11-c4-level-2--container-diagram)
12. [Non-Functional Requirements Mapping](#12-non-functional-requirements-mapping)

---

## 1. Executive Summary

Sportivox (branded Sportzicon) is a multi-role sports recruitment and networking platform built specifically for the Indian sports market. It connects athletes, clubs, scouts, event organizers, and administrators in a single verified ecosystem. Athletes publish profiles and reels, apply to opportunities posted by clubs, and receive AI-generated performance tips. Clubs and scouts browse verified talent, post vacancies, shortlist candidates, and manage the full recruitment pipeline through to selection. Organizers manage events and tournaments, while administrators govern the platform's integrity through verification workflows, moderation tools, and audit logs. The platform also ships a dedicated cricket scoring subsystem that operates as a separate service and bridges back to the main application via single sign-on.

The system is built as a classic three-tier web application — a React single-page application frontend, a Node.js REST API backend, and a PostgreSQL database hosted on Supabase — with a separately deployable scoring subsystem that shares authentication via JWT exchange. Media files and private documents are stored on Google Cloud Storage. Infrastructure is defined with Terraform, deployed to GCP Cloud Run, and continuously delivered through GitHub Actions. The architecture prioritizes developer velocity and correctness over raw throughput in its current form, with several acknowledged scaling trade-offs documented in `designs/architectural-flaws.md`.

---

## 2. System Context

### 2.1 Users and Roles

| Role       | Primary Actions                                                                 |
|------------|---------------------------------------------------------------------------------|
| Athlete    | Build profile, upload media/reels, apply to opportunities, receive AI tips      |
| Club       | Post opportunities, manage applications, search athletes, verify organisation   |
| Scout      | Browse athlete profiles, follow athletes, message, shortlist via opportunities  |
| Organizer  | Post events/tournaments as opportunities, manage participant lists              |
| Admin      | Verify organisations, moderate content, manage users, view audit logs           |
| Scorer     | Access scoring subsystem, record match scores, manage scorecards                |

### 2.2 External Actors

| Actor              | Interaction                                                             |
|--------------------|-------------------------------------------------------------------------|
| Google Cloud       | Object storage for uploaded media and private documents                 |
| OpenAI             | GPT-4o-mini inference for athlete performance tip generation            |
| Gmail / Resend     | Transactional email (verification, password reset, notifications)       |
| Supabase           | Managed PostgreSQL hosting (main application database)                  |
| GitHub Actions     | CI/CD pipeline triggering builds and deployments                        |
| GCP Cloud Run      | Serverless container execution for both backend services                |

### 2.3 Business Context

The platform addresses a gap in the Indian sports ecosystem: the absence of a structured, verified, digital channel between talent and opportunity. Traditional discovery happens through personal networks. Sportivox replaces informal word-of-mouth with a structured application workflow, verified profiles, and algorithmic discovery.

---

## 3. Component Overview

The system is composed of five major subsystems:

### 3.1 React Frontend (SPA)

A Vite 5 + React 18 single-page application. Responsible for all user interaction across every role. Communicates with the main backend exclusively via REST. Manages server state with TanStack React Query v5, client state with Zustand, and form state with react-hook-form + Zod. Routes are declared with React Router v6 and protected by role-checked wrapper components.

The frontend connects to the scoring subsystem frontend (a separate React app built with Vite) either by redirecting the user or embedding it; the scoring SPA communicates with the scoring backend via a Vite proxy path `/scoring-api`.

### 3.2 Main Backend (Node.js API)

An Express 4 server written in TypeScript, listening on port 8080. Organised into 16 feature modules:

```
auth, users, organizations, opportunities, applications,
posts (+ comments), reels, blogs, follow, messaging,
notifications, search, media, ai, verification, admin, email-logs
```

Each module owns its routes, services, and (for four modules) a repository layer. The remaining twelve modules import Prisma directly from the service layer. The backend enforces authentication via JWT middleware and role-based access control via per-route guard middleware. Zod schemas validate all request bodies before they reach service logic.

### 3.3 Scoring Subsystem

A completely separate Node.js + Express backend running on port 4000 with its own PostgreSQL database (Docker-managed locally, separate cloud instance in production). It provides cricket scoring functionality: match creation, innings management, ball-by-ball scoring, and scorecards.

The subsystem authenticates users via SSO: the main frontend exchanges the user's main JWT for a scoring-specific JWT via `POST /scoring-api/api/auth/sso`. No session state is shared between databases; player identity in the scoring DB is a foreign reference to the main app's user IDs, but no live join across the two databases exists.

### 3.4 PostgreSQL Database (Main)

Managed by Prisma ORM. Schema lives at `database/prisma/schema.prisma`. Migrations are applied via `prisma migrate deploy`. Hosted on Supabase in cloud environments. Contains all application data: users, organisations, opportunities, applications, social content, messages, notifications, audit logs.

### 3.5 Infrastructure and DevOps

Terraform configurations in `infra/terraform/` define Cloud Run services, GCS buckets, IAM roles, and VPC connector. GitHub Actions workflows in `.github/workflows/` build Docker images, run tests, and deploy to GCP Cloud Run. Local development uses `docker-compose.yml` at the project root, which starts the main backend, scoring backend, scoring PostgreSQL, and optionally the frontend dev server.

---

## 4. Technology Decisions and Rationale

### 4.1 Backend: Node.js 20 + TypeScript + Express 4

Node.js was chosen for its non-blocking I/O model, which suits a platform dominated by network-bound operations (DB queries, GCS calls, OpenAI API calls). TypeScript enforces compile-time safety across a multi-developer team working on a large schema. Express 4 was chosen over Fastify or NestJS for its minimal footprint and team familiarity. The downside is the lack of a built-in DI container; this is mitigated by manual service-layer dependency injection (see `designs/design-patterns.md`).

### 4.2 ORM: Prisma

Prisma was chosen over raw SQL or Knex for its type-safe query client generated from the schema, automatic migration management, and Supabase compatibility. The trade-off is that Prisma's abstraction layer introduces overhead for bulk operations and does not support atomic compare-and-swap for counter increments — a documented architectural flaw (ARCH-002).

### 4.3 Frontend: React 18 + Vite 5 + TanStack Query v5

React 18 with concurrent features provides a modern component model. Vite 5 offers sub-second HMR for developer productivity. TanStack Query v5 handles server state, caching, and background refetching, removing the need for Redux or manual fetch management. Zustand handles lightweight client-side state (auth session, UI preferences). This combination minimises boilerplate while keeping the data flow predictable.

### 4.4 Database: PostgreSQL via Supabase

PostgreSQL was selected over alternatives for ACID compliance, relational integrity, JSON column support (used for `athlete_data`, `coach_data`, application `history`), and array support (used for `participant_ids` in Conversation). Supabase provides managed hosting with connection pooling, point-in-time recovery, and a built-in dashboard, reducing operational overhead. The local development equivalent runs in a Docker container.

### 4.5 Auth: JWT (Access + Refresh Token Rotation)

Stateless JWT access tokens (15-minute expiry) reduce per-request database lookups. Refresh tokens (30-day expiry) are stored in the `RefreshToken` table and rotated on every use, providing revocation capability. Passwords are hashed with bcrypt at 12 rounds. This scheme balances security with the stateless nature of Cloud Run instances.

### 4.6 Infra: GCP Cloud Run + Terraform

Cloud Run's per-request scaling model suits a startup workload with variable traffic — no cost when idle. Terraform ensures reproducible infrastructure across staging and production environments. Docker Compose mirrors the production topology locally.

---

## 5. External Service Integrations

### 5.1 Google Cloud Storage (GCS)

Two buckets are used:

- **Public media bucket** — athlete profile photos, post images, reel video thumbnails. Objects are publicly readable. Uploads use a signed URL pattern: the backend generates a time-limited signed URL, the frontend uploads directly to GCS, and then notifies the backend with the resulting GCS object path. This pattern avoids routing large file payloads through the API server.

- **Private documents bucket** — verification documents submitted by organisations. Objects are not publicly readable. Access is via signed download URLs generated on demand by the backend, time-limited and scoped to the requesting user.

The GCS client is initialised in the `media` module using the `@google-cloud/storage` SDK, authenticated via a service account key injected as an environment variable.

### 5.2 OpenAI GPT-4o-mini

Used exclusively by the `ai` module to generate personalised performance improvement tips for athletes. The athlete's profile data (sport, position, stats from `athlete_data`) is composed into a prompt and sent to the Chat Completions endpoint. The model is `gpt-4o-mini` — chosen for cost efficiency over `gpt-4o` since the output is advisory rather than mission-critical. Results are returned directly to the client; they are not persisted to the database.

### 5.3 Gmail / Resend

Transactional emails are sent via either Gmail (SMTP) or Resend (API) depending on the environment configuration. The `email` module abstracts the transport behind a common interface. Use cases: email address verification links, password reset tokens, application status change notifications for athletes, and organisation verification status updates. Sent email metadata is logged to the `EmailLog` table for audit and deliverability debugging.

### 5.4 Supabase (Managed PostgreSQL)

Supabase provides the cloud PostgreSQL instance. The connection string (including pooler endpoint) is passed to Prisma as `DATABASE_URL`. Supabase's connection pooler (PgBouncer in transaction mode) is used in production to handle Cloud Run's ephemeral instance scaling. Prisma Migrate runs as a deployment step before the new container revision receives traffic.

---

## 6. Security Architecture Overview

### 6.1 Authentication

All protected endpoints require a valid JWT access token in the `Authorization: Bearer <token>` header. The `auth` middleware decodes and verifies the token using the `JWT_SECRET` environment variable, attaches the decoded user payload to `req.user`, and passes to the next middleware. Expired access tokens return `401`; the frontend's React Query interceptor automatically calls the refresh endpoint and retries the original request.

### 6.2 Authorisation (RBAC)

Route-level middleware checks `req.user.role` against an allowlist of permitted roles. For example, posting an opportunity requires `role === 'club' || role === 'organizer'`. Application-level checks (e.g., an athlete can only withdraw their own application) are enforced inside the service layer after the DB record is fetched.

### 6.3 Input Validation

All request bodies are validated by Zod schemas before reaching service logic. Invalid payloads return `400` with structured error messages. This prevents malformed data from reaching the database and mitigates injection-class issues at the application boundary.

### 6.4 Transport Security

HTTPS is enforced at the Cloud Run ingress. The Express app uses `helmet` to set security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options). CORS is configured to allow only the registered frontend origin.

### 6.5 Rate Limiting

`express-rate-limit` is applied globally and tightened on the auth routes (`/auth/login`, `/auth/register`, `/auth/forgot-password`) to prevent credential stuffing and abuse.

### 6.6 Password Security

Passwords are hashed with `bcrypt` at 12 rounds before storage. Plain-text passwords are never logged. The `Pino` logger configuration excludes the `password` field from request body logs.

### 6.7 Signed URLs for Media

Uploaded files and private documents are never served through the Node.js API server. GCS signed URLs are scoped to specific objects and expire after a short window (15 minutes for downloads, 10 minutes for uploads). This prevents unauthorised access to private documents even if the GCS bucket name is known.

### 6.8 Audit Logging

All significant state changes (application status transitions, organisation verification decisions, user bans) write a record to the `AuditLog` table, capturing actor ID, target entity, action, and timestamp. Admins can query this log through the admin module.

---

## 7. Deployment Architecture

### 7.1 Production (GCP)

```
Internet
    |
    v
GCP Cloud Load Balancer / Cloud Run Ingress (HTTPS)
    |               |
    v               v
Main Backend     Scoring Backend
Cloud Run Svc    Cloud Run Svc
(port 8080)      (port 4000)
    |               |
    v               v
Supabase        GCP Cloud SQL
PostgreSQL      PostgreSQL
(main DB)       (scoring DB)
    |
    v
GCS Buckets
(media + docs)
    |
    v
OpenAI API
Gmail / Resend
```

Each Cloud Run service is containerised from a multi-stage Dockerfile. The production image uses Node 20 Alpine, copies only compiled output, and runs as a non-root user. Environment variables (database URL, JWT secret, GCS credentials, OpenAI key) are injected via GCP Secret Manager references in the Cloud Run service definition.

### 7.2 CI/CD Pipeline

GitHub Actions workflows:
1. **On pull request** — lint, type check, unit tests, build Docker image (no push).
2. **On merge to `main`** — build Docker image, push to GCP Artifact Registry, run `prisma migrate deploy` against the production database, deploy new revision to Cloud Run with traffic migration (blue-green via revision tags).

Cloud Build YAML lives at `infra/cloudbuild.yaml` as an alternative trigger for GCP-native builds.

### 7.3 Local Development

`docker-compose.yml` at the project root starts:
- `db` — PostgreSQL 15 (main database, port 5432)
- `scoring-db` — PostgreSQL 15 (scoring database, port 5433)
- `backend` — Main Node.js API (port 8080), with volume mounts for hot reload
- `scoring-backend` — Scoring Node.js API (port 4000)

The frontend (`frontend/`) is started separately with `npm run dev` (Vite dev server, port 5173). The Vite config proxies `/scoring-api` to `http://localhost:4000`.

### 7.4 Infrastructure as Code

Terraform configurations in `infra/terraform/` manage:
- Cloud Run service definitions (image, env vars, scaling limits, VPC connector)
- GCS bucket creation, IAM bindings, CORS policies
- Artifact Registry repository
- Service account creation and role bindings
- Secret Manager secrets (referenced but values set separately)

---

## 8. Data Storage Strategy

### 8.1 Primary Database (PostgreSQL via Supabase)

All structured application data resides in a single PostgreSQL database. Prisma ORM generates a fully typed client from the schema at `database/prisma/schema.prisma`. Schema migrations are version-controlled in `database/prisma/migrations/`. The schema uses:

- **Relational foreign keys** for core associations (e.g., `Application.opportunity_id → Opportunity.id`)
- **JSON columns** for semi-structured role data (`User.athlete_data`, `User.coach_data`) and history logs (`Application.history`)
- **String arrays** for multi-value fields (`Organization.sport_categories`, `Conversation.participant_ids`)
- **Denormalised counters** on content entities (`Post.like_count`, `User.follower_count`) to avoid expensive COUNT queries on hot read paths — with the acknowledged trade-off of potential race conditions under concurrent writes

### 8.2 File Storage (GCS)

Files are stored in GCS, not the database. The database stores only the GCS object path/URL. Two buckets:
- `sportivox-media` — public, CDN-cacheable
- `sportivox-docs` — private, signed-URL access only

### 8.3 Scoring Database (separate PostgreSQL)

The scoring subsystem maintains its own PostgreSQL database with its own schema, managed by the scoring backend's Prisma instance. It stores match data, innings, over-by-over ball records, and scorecards. There is no database-level link to the main schema; player identity is referenced by user ID strings that correspond to main-app user IDs, but no foreign key constraint enforces this.

### 8.4 No Caching Layer

At the current scale, there is no Redis or Memcached layer. All reads go directly to PostgreSQL. This is an acknowledged architectural flaw (ARCH-007) and a candidate for early remediation as traffic grows.

---

## 9. Scalability Considerations

### 9.1 Current Approach (Correct for Early Stage)

- Cloud Run autoscales container instances horizontally based on request concurrency.
- PostgreSQL via Supabase with PgBouncer connection pooling handles moderate concurrent connections.
- GCS offloads file I/O completely from the API tier.
- Denormalised counters reduce read-time aggregation load.

### 9.2 Known Bottlenecks (Documented Flaws)

| Bottleneck                          | Flaw ID  | Impact at Scale                                        |
|-------------------------------------|----------|--------------------------------------------------------|
| No cache layer                      | ARCH-007 | All hot reads hit Postgres on every request            |
| Polling for messages/notifications  | ARCH-005 | Quadratic DB read pressure as users scale              |
| In-memory search filtering          | ARCH-004 | Full table scan + Node.js filter breaks at ~10k users  |
| Client-side opportunity sort        | ARCH-010 | Full dataset returned over the wire on every page load |
| Denormalised counter race condition | ARCH-002 | Under-counted likes/followers at high concurrency      |

### 9.3 Recommended Scaling Path

1. Add Redis (Upstash or GCP Memorystore) for notification counts, session caching, and rate-limit state.
2. Replace polling with WebSocket (Socket.io) for messaging and notification push.
3. Migrate search to PostgreSQL full-text search indexes (`tsvector`) or ElasticSearch.
4. Move opportunity list filtering to server-side with cursor pagination.
5. Replace atomic counter updates with `UPDATE ... SET count = count + 1` (raw SQL via Prisma `$executeRaw`) to eliminate race conditions.

---

## 10. C4 Level 1 — System Context Diagram

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                         SYSTEM CONTEXT — SPORTIVOX                         ║
╚══════════════════════════════════════════════════════════════════════════════╝

        ┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
        │  Athlete  │     │   Club /  │     │ Organizer │     │   Admin   │
        │  (User)   │     │   Scout   │     │  (User)   │     │  (User)   │
        └─────┬─────┘     └─────┬─────┘     └─────┬─────┘     └─────┬─────┘
              │                 │                 │                 │
              └─────────────────┴─────────────────┴─────────────────┘
                                          │
                                          │  HTTPS
                                          ▼
                          ┌───────────────────────────────┐
                          │                               │
                          │        SPORTIVOX PLATFORM     │
                          │   (Main Web App + Scoring)    │
                          │                               │
                          └───────────────┬───────────────┘
                                          │
              ┌──────────┬───────────────┼───────────────┬──────────┐
              │          │               │               │          │
              ▼          ▼               ▼               ▼          ▼
       ┌────────────┐ ┌──────┐  ┌──────────────┐  ┌─────────┐ ┌────────┐
       │  Supabase  │ │ GCS  │  │   OpenAI     │  │  Gmail/ │ │ GitHub │
       │ PostgreSQL │ │      │  │ GPT-4o-mini  │  │ Resend  │ │Actions │
       │  (Main DB) │ │Media │  │  (AI Tips)   │  │ (Email) │ │(CI/CD) │
       └────────────┘ │+Docs │  └──────────────┘  └─────────┘ └────────┘
                      └──────┘

        ┌──────────┐
        │  Scorer  │──────────────────────────────────────────────────────┐
        │  (User)  │                                                      │
        └──────────┘                                                      │
                                                                          ▼
                                                          ┌───────────────────────┐
                                                          │   SCORING SUBSYSTEM   │
                                                          │  (Separate Service)   │
                                                          └───────────┬───────────┘
                                                                      │
                                                                      ▼
                                                          ┌───────────────────────┐
                                                          │   Scoring PostgreSQL  │
                                                          │  (Separate Database)  │
                                                          └───────────────────────┘
```

---

## 11. C4 Level 2 — Container Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                         CONTAINER DIAGRAM — SPORTIVOX                          ║
╚══════════════════════════════════════════════════════════════════════════════════╝

 Browser
    │
    │ HTTPS :443
    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GCP Cloud Run                                      │
│                                                                                 │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │       React SPA (Frontend)      │   │        Scoring React SPA            │ │
│  │  Vite 5 + React 18 + TS         │   │   Vite + React + TS                 │ │
│  │  TanStack Query v5 + Zustand    │   │   (Separate Vite app)               │ │
│  │  React Router v6 + Tailwind     │   │                                     │ │
│  │  Port: 5173 (dev)               │   │   Port: dev server                  │ │
│  └────────────────┬────────────────┘   └──────────────┬──────────────────────┘ │
│                   │                                   │                         │
│                   │ REST /api/*                       │ REST /scoring-api/*     │
│                   │ (Bearer JWT)                      │ (Vite proxy → :4000)   │
│                   ▼                                   ▼                         │
│  ┌─────────────────────────────────┐   ┌─────────────────────────────────────┐ │
│  │     Main Backend (Node.js)      │   │    Scoring Backend (Node.js)        │ │
│  │  Express 4 + TypeScript         │   │  Express + TypeScript               │ │
│  │  Prisma ORM + Zod + Pino        │   │  Prisma ORM (own schema)            │ │
│  │  JWT Auth + bcrypt + Helmet     │   │  JWT Auth (scoring-specific)        │ │
│  │  16 feature modules             │   │                                     │ │
│  │  Port: 8080                     │   │  Port: 4000                         │ │
│  └────┬──────────┬─────────────────┘   └──────────────┬──────────────────────┘ │
│       │          │                                     │                         │
└───────┼──────────┼─────────────────────────────────────┼─────────────────────────┘
        │          │                                     │
        │          │                                     │
        ▼          ▼                                     ▼
 ┌──────────┐  ┌─────────────────────────────────┐  ┌──────────────────────────┐
 │ Supabase │  │   Google Cloud Storage          │  │  Scoring PostgreSQL      │
 │PostgreSQL│  │  ┌─────────────┐ ┌───────────┐  │  │  (Docker / Cloud SQL)    │
 │(Main DB) │  │  │sportivox-   │ │sportivox- │  │  │  Port: 5433 (local)      │
 │Port:5432 │  │  │media        │ │docs       │  │  └──────────────────────────┘
 └──────────┘  │  │(public)     │ │(private)  │  │
               │  └─────────────┘ └───────────┘  │
               └─────────────────────────────────┘
                                │
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
               ┌──────────┐ ┌──────┐ ┌─────────┐
               │  OpenAI  │ │Gmail/│ │ GitHub  │
               │GPT-4o-   │ │Resend│ │ Actions │
               │mini      │ │Email │ │ CI/CD   │
               └──────────┘ └──────┘ └─────────┘

Legend:
  ──► REST HTTP call
  ═══ Managed cloud service
```

---

## 12. Non-Functional Requirements Mapping

### 12.1 Performance

| Requirement                              | Current Implementation                              | Gap / Risk                              |
|------------------------------------------|-----------------------------------------------------|-----------------------------------------|
| API p95 response < 500ms                 | Prisma queries with indexed PKs; denorm counters    | No cache; hot reads hit DB              |
| Page load < 3s on 4G                     | Vite code splitting; lazy routes                    | Large opportunity list fetched fully    |
| File upload < 30s for 50MB video         | Direct-to-GCS signed URL upload bypasses API        | Within GCS/client limits                |
| Search results < 2s                      | SQL LIKE query + in-memory filter                   | Breaks at scale; no FTS index           |

### 12.2 Security

| Requirement                              | Implementation                                      |
|------------------------------------------|-----------------------------------------------------|
| No unauthenticated data access           | JWT middleware on all non-public routes             |
| Role-based access enforcement            | Per-route RBAC middleware + service-layer checks    |
| Password storage compliance              | bcrypt 12 rounds                                    |
| Transport encryption                     | HTTPS enforced at Cloud Run ingress + Helmet HSTS   |
| Input sanitisation                       | Zod validation on all request bodies                |
| Private document access control          | GCS signed URLs; no public bucket for docs          |
| Audit trail                              | AuditLog table for all admin/status-change actions  |

### 12.3 Availability

| Requirement                              | Implementation                                      | Gap / Risk                              |
|------------------------------------------|-----------------------------------------------------|-----------------------------------------|
| 99.5% uptime SLO                         | Cloud Run multi-instance; Supabase managed DB       | No health check endpoint documented     |
| Zero-downtime deploys                    | Cloud Run traffic splitting (blue-green revisions)  | DB migrations must be backward-compat   |
| Database backup                          | Supabase automatic daily backups + PITR             | Scoring DB backup strategy not defined  |

### 12.4 Scalability

| Requirement                              | Implementation                                      | Gap / Risk                              |
|------------------------------------------|-----------------------------------------------------|-----------------------------------------|
| Support 10k concurrent users             | Cloud Run horizontal autoscaling                    | DB connection pool saturation likely    |
| Support 1M users (future)                | Requires cache layer, FTS, WebSocket                | Multiple architectural changes needed   |
| Horizontal API scaling                   | Stateless JWT; no sticky sessions                   | Cloud Run supports natively             |

### 12.5 Maintainability

| Requirement                              | Implementation                                      |
|------------------------------------------|-----------------------------------------------------|
| TypeScript end-to-end                    | TS on backend, frontend, and scoring                |
| Schema-driven development                | Prisma schema as single source of truth             |
| Structured logging                       | Pino JSON logger with Pino-HTTP middleware          |
| Infrastructure reproducibility          | Terraform IaC for all GCP resources                |
| Design pattern documentation            | designs/design-patterns.md catalogs all 20 patterns |
