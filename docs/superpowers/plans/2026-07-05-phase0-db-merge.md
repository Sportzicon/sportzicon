# Phase 0: DB Merge & Identity Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two Postgres databases (main Supabase + scoring's own Postgres) into one, with scoring's tables under a `scoring` Postgres schema namespace inside the main database, and one identity table (main `User`) instead of two.

**Architecture:** `database/prisma/schema.prisma` becomes the single source of truth for both domains via Prisma's `multiSchema` feature (`@@schema("public")` / `@@schema("scoring")`). Scoring's own `User`/`RefreshToken` models and its separate `prisma/schema.prisma` + migration history are deleted. Scoring backend's Prisma client is generated from the shared schema (mirroring the copy-and-generate convention `backend/` already uses). Scoring's local password login (signup/login/refresh/logout, including the `admin@scoring.local` demo account) is retired — SSO-from-main-JWT becomes the only auth path, decided with the user. Scoring backend gets a minimal Socket.io server (in-memory adapter today, Redis-adapter gated behind `REDIS_URL` for later).

**Tech Stack:** Prisma 5.22.0 (multiSchema, confirmed via empirical `prisma validate`/`migrate diff` testing below — no guessing), Express, Socket.io 4.8, ioredis, Terraform, GitHub Actions.

## Global Constraints

- No prod data exists in the scoring DB yet — this is the reason this phase runs first and is lowest-risk (per `docs/SCALING_PLAN.md`).
- Do NOT run `npx prisma migrate dev` / `migrate deploy` against the shared Supabase instance from this plan. The user will apply the generated migration SQL themselves (confirmed decision). Every step in this plan that touches a schema/migration file must be verifiable with `prisma validate`, `prisma generate`, and `prisma migrate diff --script` — all of which run **fully offline**, no DB connection required (verified: `migrate diff --from-schema-datamodel/--to-schema-datamodel` needs no reachable `DATABASE_URL` at all).
- Scoring's local signup/login is retired entirely (confirmed decision) — only SSO-from-main-JWT remains. `admin@scoring.local` must become a real main-app `User` row (role `scorer` or `admin`) as part of this — call this out to the user in the final report; do not silently change the demo-account story without saying so.
- CLAUDE.md Master Rule #1 (admin override) applies to any `requireRole`/role-check code touched in this plan.
- `cd frontend && npm run typecheck && npm run build`, `cd backend && npm run typecheck`, and `cd scoring/backend && npm run build` must all pass with zero errors before this phase is done (Phase 0's own acceptance criteria in `docs/SCALING_PLAN.md`).
- Do not touch Phase 1-5 concerns (rate limiter, cookie refresh tokens, `BallEvent` correction fields beyond `season`, stats aggregation, `Tournament`/`Team` org-linkage). Those are separate phases.

## Facts Verified Before Writing This Plan (do not re-derive these)

- Prisma 5.22.0 requires `previewFeatures = ["multiSchema"]` on the generator block even though some later Prisma versions made it GA — tested directly against this repo's installed CLI (`database/node_modules/.bin/prisma validate`), confirmed via a failing-then-passing schema.
- Once `multiSchema` is enabled, **every single model and enum** needs an explicit `@@schema("...")` — partial tagging is a hard validation error (`P1012`), tested directly.
- A relation crossing schemas (e.g. scoring `Tournament.creator` → public `User`) requires the referenced model (`User`) to declare the reverse array field (e.g. `scoring_tournaments Tournament[]`) — omitting it is a hard validation error, tested directly. This produces **no physical DDL change** (it's a Prisma-only virtual field backed by the existing `created_by` column).
- Diffing the *real* current `schema.prisma` (no `@@schema` tags) against the *new* merged schema (every model tagged `@@schema("public")`) makes `prisma migrate diff` treat every existing `public` table as `DROP TABLE` + `CREATE TABLE`, because Prisma sees the schema-namespace attribution change as a structural change even though physically nothing about those tables changes. **Do not use that naive full-schema diff as the real migration** — it would drop every production table. Verified directly with a reduced repro.
- The correct approach (verified): diff a **scoring-only** temporary schema (the 13 scoring models + a minimal `User` stub containing only `id`, tagged `@@schema("public")`) from `--from-empty`, which cleanly emits only `CREATE SCHEMA "scoring"`, the 13 `CREATE TABLE "scoring".*` statements, and `AddForeignKey ... REFERENCES "public"."User"("id")` — zero mention of any real `public` table. This is the actual migration SQL to ship.
- Scoring's `requireAuth` middleware (`scoring/backend/src/middleware/auth.ts`) already accepts a main-app JWT directly (`MAIN_JWT_SECRET`) on every request and creates/updates a shadow scoring `User` row keyed by email so `created_by` FKs resolve. The frontend's real API client (`frontend/src/api/scoringClient.ts`) **always** attaches the main Sportivox JWT — it never uses the token from the `/auth/sso` exchange stored in `useScoringAuthStore`. That exchange (`ScoringGate.tsx` → `POST /auth/sso`) only populates a "logged in" UI flag; the manual-login fallback form in `ScoringGate.tsx` is the only thing that actually calls scoring's local `/auth/login`.
- Main JWT access-token payload (`backend/src/modules/auth/tokens.ts`): `{ sub: user.id, role, email, name: user.full_name, type: "access" }` — `sub` is already the main `User.id`, so once scoring tables FK straight to `User.id`, no shadow-row lookup is needed at all; `claims.sub` can be used directly.
- Scoring's only `requireRole(...)` call sites (`scoring/backend/src/modules/scoring/scoring.routes.ts`) only ever check for `"organizer"`, `"admin"`, `"scorer"` — never `"viewer"`. Main `Role` enum has no `"viewer"` value. Dropping scoring's `mapRole()`/`UserRole` concept entirely and using the main `Role` string directly (`athlete`/`club`/`scout`/`organizer`/`scorer`/`admin`) preserves identical authorization behavior (athletes/clubs/scouts still fail every `requireRole` check, same as being mapped to `"viewer"` before).
- `backend/` already has the exact convention scoring backend needs: `"db:generate": "node -e \"require('fs').copyFileSync('../database/prisma/schema.prisma','./prisma/schema.prisma')\" && prisma generate"` in `backend/package.json`, and `backend/Dockerfile`'s build stage does `COPY database/prisma ./prisma` then `prisma generate`. Mirror both for `scoring/backend`.
- `docker-compose.yml`'s `api` service already points `DATABASE_URL`/`DIRECT_URL` at the real cloud Supabase instance (there is no disposable local Postgres for the main app) — `scoring-backend`/`scoring-db` are the only local-only Postgres pieces being removed.

---

## File Structure

| File | Responsibility |
|---|---|
| `database/prisma/schema.prisma` | Modify — single merged schema, multiSchema, all models tagged, scoring models added |
| `database/prisma/migrations/<ts>_merge_scoring_schema/migration.sql` | Create — hand-verified scoring-only migration SQL (user applies later) |
| `scoring/backend/prisma/schema.prisma`, `scoring/backend/prisma/migrations/` | Delete |
| `scoring/backend/package.json` | Modify — `db:generate` script, add `socket.io`/`ioredis`/`@socket.io/redis-adapter` deps |
| `scoring/backend/Dockerfile` | Modify — copy `database/prisma` instead of `scoring/backend/prisma` |
| `scoring/backend/Dockerfile.dev` | Modify — same copy-source change |
| `scoring/backend/src/modules/auth/auth.routes.ts` | Modify — delete signup/login/refresh/logout routes, keep `/sso` |
| `scoring/backend/src/modules/auth/auth.service.ts` | Modify — delete signup/login/refresh/logout, rewrite `ssoFromMainToken` stateless |
| `scoring/backend/src/middleware/auth.ts` | Modify — drop shadow-user DB lookup, decode claims directly |
| `scoring/backend/src/lib/socket.ts` | Create — minimal Socket.io server, `REDIS_URL`-gated adapter |
| `scoring/backend/src/server.ts` | Modify — wrap in `http.createServer`, call `initSocket` |
| `scoring/backend/prisma/seed.ts`, `seed-ipl2026-final.ts` | Modify — create merged-shape `User` row instead of scoring-shape |
| `frontend/src/modules/live-scoring/pages/ScoringGate.tsx` | Modify — remove manual-login fallback form |
| `frontend/src/store/scoringAuth.ts` | Modify — `refreshToken` becomes nullable |
| `docker-compose.yml` | Modify — remove `scoring-db` service, point `scoring-backend` at shared Supabase URL |
| `infra/terraform/variables.tf` | Modify — remove `scoring_database_url`/`scoring_direct_url` |
| `infra/terraform/cloudrun.tf` | Modify — scoring service `DATABASE_URL`/`DIRECT_URL` use `var.database_url`/`var.direct_url` directly |
| `.github/workflows/deploy-staging.yml`, `deploy-production.yml` | Modify — remove `migrate-scoring-db` job, remove scoring DB secret refs |
| `scoring/backend/.env.example` | Modify — document shared `DATABASE_URL`, add optional `REDIS_URL` |

---

### Task 1: Merge the Prisma schema

**Files:**
- Modify: `database/prisma/schema.prisma`

**Interfaces:**
- Produces: merged Prisma schema every later task's migration/service code depends on — `User` model gains `scoring_tournaments Tournament[]`; all 13 scoring models exist under `@@schema("scoring")`; `BallEvent`/`MatchEvent` gain `season String?` and `year Int?`.

- [ ] **Step 1: Replace `database/prisma/schema.prisma` in full**

Full replacement content (existing `public`-schema content unchanged except added `@@schema("public")` tags and the new `scoring_tournaments` relation field on `User`; scoring content is the existing `scoring/backend/prisma/schema.prisma` minus `User`/`RefreshToken`/`UserRole`, plus `@@schema("scoring")` tags and `season`/`year` columns):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
  schemas   = ["public", "scoring"]
}

enum Role {
  athlete
  club
  scout
  organizer
  admin
  scorer

  @@schema("public")
}

enum AccountStatus {
  active
  suspended
  pending

  @@schema("public")
}

enum VerificationStatus {
  unverified
  pending
  approved
  rejected

  @@schema("public")
}

enum OpportunityType {
  trial
  recruitment
  scholarship
  tournament
  coaching_job

  @@schema("public")
}

enum OpportunityStatus {
  open
  closed
  filled

  @@schema("public")
}

enum ApplicationStatus {
  pending
  shortlisted
  selected
  rejected
  withdrawn

  @@schema("public")
}

model User {
  id                 String             @id @default(uuid()) @db.Uuid
  email              String             @unique
  email_lower        String             @unique
  email_verified     Boolean            @default(false)
  phone              String?
  phone_verified     Boolean            @default(false)
  password_hash      String
  full_name          String
  full_name_lower    String
  role               Role
  status             AccountStatus      @default(active)
  bio                String?            @db.Text
  profile_photo_url  String?
  cover_photo_url    String?
  country            String?
  state              String?
  city               String?
  dob                String?
  gender             String?
  preferred_language String?

  verification_status VerificationStatus @default(unverified)
  verification_badges String[]           @default([])

  athlete_data Json?
  coach_data   Json?

  is_suspended      Boolean  @default(false)
  suspension_reason String?
  suspended_at      DateTime?

  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt
  last_active_at DateTime @default(now())

  @@index([full_name_lower])
  @@index([status, created_at(sort: Desc)])
  @@index([role, status])

  organizations  Organization[]
  opportunities  Opportunity[]   @relation("PostedBy")
  applications   Application[]
  posts          Post[]
  reels          Reel[]
  blogs          Blog[]
  comments       Comment[]
  messages_sent  Message[]       @relation("Sender")
  unread_counts  UnreadCount[]
  notifications         Notification[]  @relation("NotificationRecipient")
  actor_notifications   Notification[]  @relation("NotificationActor")
  followers      Follow[]        @relation("Followee")
  following      Follow[]        @relation("Follower")
  reports_made   Report[]        @relation("Reporter")
  audit_logs     AuditLog[]
  post_likes     PostLike[]
  reel_likes     ReelLike[]
  blog_likes     BlogLike[]
  comment_likes  CommentLike[]
  documents      UserDocument[]
  email_logs     EmailLog[]
  tournaments    AthleteTournament[]
  scoring_tournaments Tournament[]

  @@schema("public")
}

model UserDocument {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  type        String
  file_name   String
  url         String
  size_bytes  Int
  created_at  DateTime @default(now())

  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@schema("public")
}

model AthleteTournament {
  id          String   @id @default(uuid()) @db.Uuid
  user_id     String   @db.Uuid
  name        String
  year        String
  team        String?
  format      String?
  result      String?
  created_at  DateTime @default(now())

  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@schema("public")
}

model Organization {
  id                   String             @id @default(uuid()) @db.Uuid
  owner_user_id        String             @db.Uuid
  org_name             String
  org_name_lower       String
  org_type             String
  description          String?            @db.Text
  logo_url             String?
  cover_url            String?
  sport_categories     String[]
  year_established     Int?
  country              String?
  state                String?
  city                 String?
  address              String?
  website              String?
  contact_name         String?
  contact_email        String?
  contact_phone        String?
  social_links         Json?
  registration_doc_url String?
  verification_status  VerificationStatus @default(unverified)
  verification_badges  String[]           @default([])
  subscription_plan    String             @default("free")

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  owner         User          @relation(fields: [owner_user_id], references: [id])
  opportunities Opportunity[]
  documents     OrgDocument[]

  @@index([owner_user_id, created_at(sort: Desc)])
  @@index([org_name_lower])
  @@index([verification_status])
  @@schema("public")
}

model OrgDocument {
  id          String   @id @default(uuid()) @db.Uuid
  org_id      String   @db.Uuid
  key         String
  name        String
  uploaded_at DateTime @default(now())

  organization Organization @relation(fields: [org_id], references: [id], onDelete: Cascade)

  @@index([org_id])
  @@schema("public")
}

model Opportunity {
  id                        String            @id @default(uuid()) @db.Uuid
  org_id                    String            @db.Uuid
  posted_by_user_id         String            @db.Uuid
  title                     String
  title_lower               String
  type                      OpportunityType
  sport                     String
  description               String            @db.Text
  eligibility               String?
  age_min                   Int
  age_max                   Int
  gender_eligibility        String            @default("all")
  experience_level_required String            @default("any")
  country                   String
  state                     String
  city                      String
  start_date                String
  end_date                  String
  application_deadline      DateTime          @db.Date
  entry_fee                 Float?
  documents_required        String[]          @default([])
  vacancies                 Int?
  vacancies_filled          Int               @default(0)
  contact_email             String?
  contact_phone             String?
  status                    OpportunityStatus @default(open)
  application_count         Int               @default(0)

  // Link to scoring console Tournament — cross-DB reference, no FK
  scoring_tournament_id     String?

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  organization Organization  @relation(fields: [org_id], references: [id])
  posted_by    User          @relation("PostedBy", fields: [posted_by_user_id], references: [id])
  applications Application[]

  @@index([status, sport, city])
  @@index([status, type])
  @@index([org_id])
  @@schema("public")
}

model Application {
  id                String            @id @default(uuid()) @db.Uuid
  opportunity_id    String            @db.Uuid
  applicant_user_id String            @db.Uuid
  cover_note        String?           @db.Text
  documents         String[]          @default([])
  status            ApplicationStatus @default(pending)
  rejection_reason  String?
  history           Json              @default("[]")
  applied_at        DateTime          @default(now())
  updated_at        DateTime          @updatedAt

  opportunity Opportunity @relation(fields: [opportunity_id], references: [id])
  applicant   User        @relation(fields: [applicant_user_id], references: [id])

  @@unique([opportunity_id, applicant_user_id])
  @@index([applicant_user_id])
  @@index([opportunity_id])
  @@schema("public")
}

model Follow {
  id          String   @id @default(uuid()) @db.Uuid
  follower_id String   @db.Uuid
  followee_id String   @db.Uuid
  created_at  DateTime @default(now())

  follower User @relation("Follower", fields: [follower_id], references: [id])
  followee User @relation("Followee", fields: [followee_id], references: [id])

  @@unique([follower_id, followee_id])
  @@index([followee_id])
  @@schema("public")
}

model Post {
  id            String   @id @default(uuid()) @db.Uuid
  author_id     String   @db.Uuid
  type          String   @default("post")
  text          String   @db.Text
  media_urls    String[] @default([])
  sport         String?
  tags          String[] @default([])
  like_count    Int      @default(0)
  comment_count Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  author   User       @relation(fields: [author_id], references: [id])
  comments Comment[]  @relation("PostComments")
  likes    PostLike[]

  @@index([author_id, created_at(sort: Desc)])
  @@schema("public")
}

model Reel {
  id               String   @id @default(uuid()) @db.Uuid
  author_id        String   @db.Uuid
  title            String?
  description      String?
  caption          String?
  video_url        String
  thumbnail_url    String?
  duration_seconds Int?
  sport            String?
  like_count       Int      @default(0)
  comment_count    Int      @default(0)
  created_at       DateTime @default(now())

  author   User       @relation(fields: [author_id], references: [id])
  comments Comment[]  @relation("ReelComments")
  likes    ReelLike[]

  @@index([author_id, created_at(sort: Desc)])
  @@index([created_at(sort: Desc)])
  @@schema("public")
}

model Blog {
  id              String    @id @default(uuid()) @db.Uuid
  author_id       String    @db.Uuid
  title           String
  slug            String    @unique
  cover_image_url String?
  excerpt         String    @db.Text
  body_markdown   String    @db.Text
  tags            String[]  @default([])
  sport           String?
  status          String    @default("draft")
  like_count      Int       @default(0)
  comment_count   Int       @default(0)
  published_at    DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  author   User       @relation(fields: [author_id], references: [id])
  comments Comment[]  @relation("BlogComments")
  likes    BlogLike[]

  @@index([status, published_at(sort: Desc)])
  @@index([author_id, created_at(sort: Desc)])
  @@index([slug])
  @@schema("public")
}

model Comment {
  id          String   @id @default(uuid()) @db.Uuid
  parent_type String
  post_id     String?  @db.Uuid
  reel_id     String?  @db.Uuid
  blog_id     String?  @db.Uuid
  author_id   String   @db.Uuid
  text        String   @db.Text
  like_count  Int      @default(0)
  created_at  DateTime @default(now())

  author User          @relation(fields: [author_id], references: [id])
  post   Post?          @relation("PostComments", fields: [post_id], references: [id])
  reel   Reel?          @relation("ReelComments", fields: [reel_id], references: [id])
  blog   Blog?          @relation("BlogComments", fields: [blog_id], references: [id])
  likes  CommentLike[]

  @@index([post_id, created_at(sort: Desc)])
  @@index([reel_id, created_at(sort: Desc)])
  @@index([blog_id, created_at(sort: Desc)])
  @@schema("public")
}

model CommentLike {
  comment_id String   @db.Uuid
  user_id    String   @db.Uuid
  created_at DateTime @default(now())

  comment Comment @relation(fields: [comment_id], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([comment_id, user_id])
  @@schema("public")
}

model Conversation {
  id              String   @id @default(uuid()) @db.Uuid
  participant_ids String[]
  last_message    Json?
  unread_counts   Json     @default("{}")
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  messages      Message[]
  unread_counts_table UnreadCount[]

  @@index([participant_ids])
  @@schema("public")
}

model UnreadCount {
  id              String   @id @default(uuid()) @db.Uuid
  conversation_id String   @db.Uuid
  user_id         String   @db.Uuid
  count           Int      @default(0)

  conversation Conversation @relation(fields: [conversation_id], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([conversation_id, user_id])
  @@index([user_id])
  @@schema("public")
}

model Message {
  id              String    @id @default(uuid()) @db.Uuid
  conversation_id String    @db.Uuid
  sender_id       String    @db.Uuid
  recipient_id    String    @db.Uuid
  body            String    @db.Text
  read_at         DateTime?
  flagged         Boolean   @default(false)
  created_at      DateTime  @default(now())

  conversation Conversation @relation(fields: [conversation_id], references: [id])
  sender       User         @relation("Sender", fields: [sender_id], references: [id])

  @@index([conversation_id, created_at(sort: Desc)])
  @@schema("public")
}

model Notification {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  actor_id   String?  @db.Uuid
  type       String
  title      String
  body       String
  link       String?
  read       Boolean  @default(false)
  created_at DateTime @default(now())

  user  User  @relation("NotificationRecipient", fields: [user_id], references: [id])
  actor User? @relation("NotificationActor", fields: [actor_id], references: [id])

  @@index([user_id, created_at(sort: Desc)])
  @@index([user_id, read])
  @@schema("public")
}

model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  actor_id    String   @db.Uuid
  actor_role  Role
  action      String
  target_type String?
  target_id   String?  @db.Uuid
  details     Json?
  ip          String?
  created_at  DateTime @default(now())

  actor User @relation(fields: [actor_id], references: [id])

  @@index([actor_id])
  @@index([created_at(sort: Desc)])
  @@schema("public")
}

model Report {
  id          String    @id @default(uuid()) @db.Uuid
  reporter_id String    @db.Uuid
  target_type String
  target_id   String    @db.Uuid
  reason      String    @db.Text
  status      String    @default("open")
  resolved_by String?   @db.Uuid
  resolved_at DateTime?
  notes       String?
  created_at  DateTime  @default(now())

  reporter User @relation("Reporter", fields: [reporter_id], references: [id])

  @@index([status, created_at(sort: Desc)])
  @@index([reporter_id])
  @@schema("public")
}

model Verification {
  id                String             @id @default(uuid()) @db.Uuid
  entity_type       String
  entity_id         String             @db.Uuid
  verification_type String
  documents         String[]
  notes             String?
  status            VerificationStatus @default(pending)
  submitted_by      String             @db.Uuid
  reviewed_by       String?            @db.Uuid
  reviewed_at       DateTime?
  rejection_reason  String?
  created_at        DateTime           @default(now())

  @@index([status, created_at(sort: Desc)])
  @@index([submitted_by])
  @@index([entity_id])
  @@schema("public")
}

enum EmailType {
  email_verification
  password_reset
  notification
  other

  @@schema("public")
}

enum EmailStatus {
  sent
  failed
  stub

  @@schema("public")
}

model EmailLog {
  id         String      @id @default(uuid()) @db.Uuid
  user_id    String?     @db.Uuid
  to_email   String
  subject    String
  email_type EmailType   @default(other)
  status     EmailStatus @default(sent)
  error      String?
  created_at DateTime    @default(now())

  user User? @relation(fields: [user_id], references: [id], onDelete: SetNull)

  @@index([user_id, created_at(sort: Desc)])
  @@index([created_at(sort: Desc)])
  @@index([email_type])
  @@index([status])
  @@schema("public")
}

model EmailVerification {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  token      String   @unique
  expires_at DateTime
  created_at DateTime @default(now())

  @@index([user_id])
  @@schema("public")
}

model PasswordReset {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  token      String   @unique
  expires_at DateTime
  used       Boolean  @default(false)
  created_at DateTime @default(now())

  @@index([user_id])
  @@schema("public")
}

model RefreshToken {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  token      String   @unique
  expires_at DateTime
  revoked    Boolean  @default(false)
  created_at DateTime @default(now())

  @@index([user_id])
  @@schema("public")
}

model LoginAttempt {
  id           String   @id @default(uuid()) @db.Uuid
  email        String
  attempted_at DateTime @default(now())

  @@index([email, attempted_at])
  @@schema("public")
}

model PostLike {
  post_id    String   @db.Uuid
  user_id    String   @db.Uuid
  created_at DateTime @default(now())

  post Post @relation(fields: [post_id], references: [id], onDelete: Cascade)
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([post_id, user_id])
  @@schema("public")
}

model ReelLike {
  reel_id    String   @db.Uuid
  user_id    String   @db.Uuid
  created_at DateTime @default(now())

  reel Reel @relation(fields: [reel_id], references: [id], onDelete: Cascade)
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([reel_id, user_id])
  @@schema("public")
}

model BlogLike {
  blog_id    String   @db.Uuid
  user_id    String   @db.Uuid
  created_at DateTime @default(now())

  blog Blog @relation(fields: [blog_id], references: [id], onDelete: Cascade)
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([blog_id, user_id])
  @@schema("public")
}

// ══════════════════════════════════════════════════════════════════════════
// Scoring domain — merged from scoring/backend/prisma/schema.prisma.
// Its own User/RefreshToken models are dropped; every FK that pointed at
// them now points at the main User model above.
// ══════════════════════════════════════════════════════════════════════════

enum TournamentStatus {
  upcoming
  ongoing
  completed
  cancelled

  @@schema("scoring")
}

enum MatchStatus {
  upcoming
  live
  completed
  abandoned
  no_result

  @@schema("scoring")
}

enum BattingStatus {
  yet_to_bat
  not_out
  out
  retired_hurt

  @@schema("scoring")
}

model Tournament {
  id          String           @id @default(uuid()) @db.Uuid
  name        String
  sport       String           // "cricket", "football", "basketball"
  format      String?          // "T20", "ODI", "Test", "League", "Knockout"
  season      String?          // "2026", "2025-26"
  match_type  String?          // "league" · "tournament" · "friendly" · "trial" · "academy" · "knockout"
  description String?          @db.Text
  start_date  String?
  end_date    String?
  location    String?
  status      TournamentStatus @default(upcoming)

  // Cricket match configuration (PPTX § Team Scoring · Match & Innings setup)
  overs_per_innings    Int?     // T20 → 20, ODI → 50, custom integer
  number_of_innings    Int?     // 2 (LO) or 4 (Test)
  ball_type            String?  // "red" · "white" · "pink"
  powerplay_overs      Json?    // { pp_start: 1, pp_end: 6, death_start: 16, death_end: 20 }
  super_over_enabled   Boolean  @default(false)
  dls_enabled          Boolean  @default(false)
  free_hit_enabled     Boolean  @default(true)
  no_ball_rule         String?  // "front_foot" · "back_foot" · "both"
  wide_rule            String?  // "men" · "women" · "junior" — affects tramline width
  tie_break_rule       String?  // "super_over" · "boundary_count" · "shared"
  retired_hurt_allowed Boolean  @default(true)
  substitutes_allowed  Boolean  @default(true)
  logo_url    String?
  banner_url  String?
  is_public   Boolean          @default(true)

  // Link to main Sportivox Opportunity (type=tournament) — cross-DB reference, no FK
  opportunity_id String?       @db.Uuid

  created_by  String           @db.Uuid
  creator     User             @relation(fields: [created_by], references: [id], onDelete: Cascade)

  teams       Team[]
  matches     Match[]

  created_at  DateTime         @default(now())
  updated_at  DateTime         @updatedAt

  @@index([status, sport])
  @@index([created_by])
  @@index([opportunity_id])
  @@schema("scoring")
}

model Team {
  id            String     @id @default(uuid()) @db.Uuid
  tournament_id String     @db.Uuid
  name          String
  short_name    String?    // e.g. "CSK", "RCB"
  logo_url      String?
  color         String?    // hex color for UI

  tournament      Tournament @relation(fields: [tournament_id], references: [id], onDelete: Cascade)
  players         Player[]
  home_matches    Match[]    @relation("Team1")
  away_matches    Match[]    @relation("Team2")
  batting_innings Innings[]  @relation("BattingTeam")
  bowling_innings Innings[]  @relation("BowlingTeam")
  match_players   MatchPlayer[]

  created_at    DateTime   @default(now())

  @@index([tournament_id])
  @@schema("scoring")
}

model Player {
  id             String    @id @default(uuid()) @db.Uuid
  team_id        String    @db.Uuid
  name           String
  jersey_number  Int?
  role           String?   // "batsman","bowler","all-rounder","wicket-keeper","goalkeeper"
  batting_style  String?   // "right-hand bat","left-hand bat"
  bowling_style  String?   // "right-arm fast","left-arm off-spin" etc.
  is_captain     Boolean   @default(false)
  is_keeper      Boolean   @default(false)
  photo_url      String?

  // Link to Sportivox user (for future integration)
  sportivox_user_id String?

  team            Team      @relation(fields: [team_id], references: [id], onDelete: Cascade)
  batting_entries BattingEntry[]
  bowling_entries BowlingEntry[]
  fielding_entries FieldingEntry[]
  ball_as_batsman BallEvent[] @relation("BallBatsman")
  ball_as_bowler  BallEvent[] @relation("BallBowler")
  career_stats    PlayerCareerStats?
  match_players   MatchPlayer[]

  created_at     DateTime  @default(now())

  @@index([team_id])
  @@schema("scoring")
}

model Match {
  id             String      @id @default(uuid()) @db.Uuid
  tournament_id  String      @db.Uuid
  match_number   Int?
  title          String?     // "Semi-Final 1", "Group A - Match 3"
  sport          String
  format         String?

  team1_id       String      @db.Uuid
  team2_id       String      @db.Uuid
  venue          String?
  scheduled_at   DateTime?
  status         MatchStatus @default(upcoming)

  winner_team_id String?     @db.Uuid
  result_summary String?

  toss_winner_id String?     @db.Uuid
  toss_decision  String?     // "bat" or "bowl"

  // Playing level for each team in this match
  team1_playing_level  String?  // "amateur" | "club" | "district" | "state" | "national" | "international"
  team2_playing_level  String?

  // Match context for analytics filtering
  match_type     String?     // "league" · "friendly" · "trial" · "academy" · "knockout"

  // Match officials
  umpire1        String?
  umpire2        String?
  tv_umpire      String?
  match_referee  String?

  // Player of the Match — no FK (cross-team reference, UUID only)
  player_of_match_id String? @db.Uuid

  // For non-cricket sports: flexible event-based score data
  match_data     Json?       // { team1_score: 0, team2_score: 0, events: [] }

  tournament     Tournament  @relation(fields: [tournament_id], references: [id], onDelete: Cascade)
  team1          Team        @relation("Team1", fields: [team1_id], references: [id])
  team2          Team        @relation("Team2", fields: [team2_id], references: [id])

  innings        Innings[]
  events         MatchEvent[]
  playing_xi     MatchPlayer[]

  created_at     DateTime    @default(now())
  updated_at     DateTime    @updatedAt

  @@index([tournament_id, status])
  @@index([status])
  @@schema("scoring")
}

model MatchPlayer {
  id               String  @id @default(uuid()) @db.Uuid
  match_id         String  @db.Uuid
  team_id          String  @db.Uuid
  player_id        String  @db.Uuid
  batting_position Int?    // 1-11, set when XI is locked
  is_impact_player Boolean @default(false) // IPL Impact Player rule substitution

  match   Match   @relation(fields: [match_id], references: [id], onDelete: Cascade)
  team    Team    @relation(fields: [team_id], references: [id], onDelete: Cascade)
  player  Player  @relation(fields: [player_id], references: [id], onDelete: Cascade)

  @@unique([match_id, player_id])
  @@index([match_id, team_id])
  @@schema("scoring")
}

model Innings {
  id              String    @id @default(uuid()) @db.Uuid
  match_id        String    @db.Uuid
  innings_number  Int       // 1 or 2 (up to 4 for Test)
  batting_team_id String    @db.Uuid
  bowling_team_id String    @db.Uuid

  total_runs      Int       @default(0)
  total_wickets   Int       @default(0)
  total_balls     Int       @default(0)
  extras          Int       @default(0)
  wides           Int       @default(0)
  no_balls        Int       @default(0)
  byes            Int       @default(0)
  leg_byes        Int       @default(0)
  penalty_runs    Int       @default(0)

  // Boundary / dot counters (PPTX § Team Analytics)
  boundary_4s     Int       @default(0)
  boundary_6s     Int       @default(0)
  dot_balls       Int       @default(0)

  // Phase splits (PP / Middle / Death) — denormalised for fast reads
  pp_runs         Int       @default(0)
  pp_wickets      Int       @default(0)
  pp_balls        Int       @default(0)
  mid_runs        Int       @default(0)
  mid_wickets     Int       @default(0)
  mid_balls       Int       @default(0)
  death_runs      Int       @default(0)
  death_wickets   Int       @default(0)
  death_balls     Int       @default(0)

  // Derived metrics (PPTX § Live Innings Tracking & Analytics)
  projected_score Int?
  win_probability Float?
  momentum_index  Float?    // -1 falling, 0 neutral, +1 rising

  target          Int?
  is_declared     Boolean   @default(false)
  is_completed    Boolean   @default(false)

  match           Match     @relation(fields: [match_id], references: [id], onDelete: Cascade)
  batting_team    Team      @relation("BattingTeam", fields: [batting_team_id], references: [id])
  bowling_team    Team      @relation("BowlingTeam", fields: [bowling_team_id], references: [id])
  batting_entries BattingEntry[]
  bowling_entries BowlingEntry[]
  fielding_entries FieldingEntry[]
  partnerships     Partnership[]
  ball_events     BallEvent[]

  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  @@unique([match_id, innings_number])
  @@index([match_id])
  @@schema("scoring")
}

model BattingEntry {
  id               String        @id @default(uuid()) @db.Uuid
  innings_id       String        @db.Uuid
  player_id        String        @db.Uuid
  batting_position Int

  runs             Int           @default(0)
  balls_faced      Int           @default(0)
  fours            Int           @default(0)
  sixes            Int           @default(0)
  dot_balls        Int           @default(0)
  singles          Int           @default(0)
  doubles          Int           @default(0)
  threes           Int           @default(0)

  status           BattingStatus @default(yet_to_bat)
  dismissal_type   String?       // "caught","bowled","lbw","run_out","stumped","hit_wicket"
  dismissed_by_id  String?       @db.Uuid
  fielder_id       String?       @db.Uuid
  dismissal_desc   String?

  // Dismissal context (PPTX § Batter Dismissal & Analytics) — denormalised for scorecard view
  dismissal_shot     String?
  dismissal_line     String?
  dismissal_length   String?
  dismissal_bowler_type String?
  dismissal_zone     String?
  dismissal_trajectory String?
  dismissal_fielding_position String?

  // Post-match scouting (PPTX § Batter Scouting)
  strong_zone      String?       // "cover" · "straight" · "mid_wicket" · "square_leg" · "fine_leg" · "all_around"
  weak_zone        String?       // "outside_off" · "short_ball" · "yorker" · "vs_spin" · "vs_la_pace"
  strength_vs      String?       // "pace" · "spin" · "la_pace" · "ra_pace" · "la_spin" · "leg_spin"
  preferred_zone   String?       // "off_side" · "leg_side" · "straight" · "360"
  scouting_notes   String?       @db.Text

  innings          Innings       @relation(fields: [innings_id], references: [id], onDelete: Cascade)
  player           Player        @relation(fields: [player_id], references: [id], onDelete: Cascade)

  created_at       DateTime      @default(now())
  updated_at       DateTime      @updatedAt

  @@unique([innings_id, player_id])
  @@index([innings_id])
  @@schema("scoring")
}

model BowlingEntry {
  id            String   @id @default(uuid()) @db.Uuid
  innings_id    String   @db.Uuid
  player_id     String   @db.Uuid

  balls         Int      @default(0)
  maidens       Int      @default(0)
  runs_conceded Int      @default(0)
  wickets       Int      @default(0)
  wides         Int      @default(0)
  no_balls      Int      @default(0)
  dot_balls     Int      @default(0)
  boundaries_4s Int      @default(0)
  boundaries_6s Int      @default(0)

  // Spell tracking (PPTX § Bowler Spell & Analytics)
  spell_number  Int?     // 1 = first spell, 2 = return spell, etc
  spell_start_over Int?
  spell_end_over Int?

  // Phase-wise splits (PPTX § Phase-wise economy)
  pp_runs       Int      @default(0)
  pp_balls      Int      @default(0)
  pp_wickets    Int      @default(0)
  mid_runs      Int      @default(0)
  mid_balls     Int      @default(0)
  mid_wickets   Int      @default(0)
  death_runs    Int      @default(0)
  death_balls   Int      @default(0)
  death_wickets Int      @default(0)

  innings       Innings  @relation(fields: [innings_id], references: [id], onDelete: Cascade)
  player        Player   @relation(fields: [player_id], references: [id], onDelete: Cascade)

  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([innings_id, player_id])
  @@index([innings_id])
  @@schema("scoring")
}

model FieldingEntry {
  id                  String   @id @default(uuid()) @db.Uuid
  innings_id          String   @db.Uuid
  player_id           String   @db.Uuid

  catches             Int      @default(0)
  drops               Int      @default(0)
  run_outs_direct     Int      @default(0)
  run_outs_assist     Int      @default(0)
  stumpings           Int      @default(0)
  direct_hits         Int      @default(0)
  misfields           Int      @default(0)
  assists             Int      @default(0)

  // Derived: catches + run_outs + stumpings - drops - misfields
  impact_score        Int      @default(0)

  innings             Innings  @relation(fields: [innings_id], references: [id], onDelete: Cascade)
  player              Player   @relation(fields: [player_id], references: [id], onDelete: Cascade)

  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  @@unique([innings_id, player_id])
  @@index([innings_id])
  @@schema("scoring")
}

model Partnership {
  id            String   @id @default(uuid()) @db.Uuid
  innings_id    String   @db.Uuid
  wicket_number Int      // partnership for this wicket (0 = opening pair, 1 = 1st wkt fall, ...)

  player1_id    String   @db.Uuid
  player2_id    String   @db.Uuid

  runs          Int      @default(0)
  balls         Int      @default(0)
  fours         Int      @default(0)
  sixes         Int      @default(0)

  is_unbroken   Boolean  @default(true)
  ended_over    Int?
  ended_ball    Int?

  innings       Innings  @relation(fields: [innings_id], references: [id], onDelete: Cascade)

  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([innings_id, wicket_number])
  @@index([innings_id])
  @@schema("scoring")
}

model BallEvent {
  id                  String   @id @default(uuid()) @db.Uuid
  innings_id          String   @db.Uuid
  over_number         Int
  ball_number         Int

  batsman_id          String   @db.Uuid
  bowler_id           String   @db.Uuid
  non_striker_id      String?  @db.Uuid

  runs                Int      @default(0)
  is_wide             Boolean  @default(false)
  is_no_ball          Boolean  @default(false)
  is_bye              Boolean  @default(false)
  is_leg_bye          Boolean  @default(false)
  is_penalty          Boolean  @default(false)
  is_wicket           Boolean  @default(false)
  is_four             Boolean  @default(false)
  is_six              Boolean  @default(false)
  is_free_hit         Boolean  @default(false)
  is_dot              Boolean  @default(false)

  // PPTX § Level 1 ball entry — captured every delivery
  shot_type           String?  // "defensive","drive","cut","pull","sweep","flick","lofted","edge","no_shot"
  ball_line           String?  // "outside_off_wide","outside_off","off_stump","middle","leg_stump","outside_leg","down_leg_wide"
  ball_length         String?  // "yorker","full","good_length","back_of_length","short","bouncer"
  bowler_variant      String?  // "rf","rfm","rmf","rm","lf","lfm","lm","ob","lb","googly","sla","slw","doosra","carrom","teesra"
  delivery_outcome    String?  // "dot","1","2","3","4","6","wide","no_ball","bye","leg_bye","wicket"

  // Match phase derived at write-time
  phase               String?  // "pp" · "mid" · "death"

  // Season/year for future partitioning (Phase 0 seam — free now, expensive to retrofit later)
  season              String?
  year                Int?

  // PPTX § Level 2 wicket panel
  wicket_type         String?  // "caught","bowled","lbw","run_out","stumped","hit_wicket","cb","retired_hurt","obstruction"
  dismissed_player_id String?  @db.Uuid
  fielder_id          String?  @db.Uuid
  fielder_name        String?  // free text fallback if fielder not in roster
  fielding_position   String?  // see PPTX positions list (wk, slip_1, gully, cover, mid_off, ...)
  dismissal_zone      String?  // "off_side","leg_side","straight","behind_wicket"
  ball_trajectory     String?  // "edged_behind","top_edge","leading_edge","mishit","beaten","trapped","squeezed"

  // Optional commentary text
  commentary          String?

  innings             Innings  @relation(fields: [innings_id], references: [id], onDelete: Cascade)
  batsman             Player   @relation("BallBatsman", fields: [batsman_id], references: [id])
  bowler              Player   @relation("BallBowler", fields: [bowler_id], references: [id])

  created_at          DateTime @default(now())

  @@index([innings_id, over_number, ball_number])
  @@index([innings_id, phase])
  @@index([bowler_id, ball_length])
  @@index([bowler_id, ball_line])
  @@schema("scoring")
}

model PlayerCareerStats {
  id                   String   @id @default(uuid()) @db.Uuid
  player_id            String   @unique @db.Uuid

  // Batting
  matches_played       Int      @default(0)
  innings_batted       Int      @default(0)
  total_runs           Int      @default(0)
  balls_faced          Int      @default(0)
  highest_score        Int      @default(0)
  not_outs             Int      @default(0)
  hundreds             Int      @default(0)
  fifties              Int      @default(0)
  fours                Int      @default(0)
  sixes                Int      @default(0)

  // Bowling
  innings_bowled       Int      @default(0)
  balls_bowled         Int      @default(0)
  runs_conceded        Int      @default(0)
  wickets              Int      @default(0)
  maidens              Int      @default(0)
  five_wicket_hauls    Int      @default(0)
  best_bowling_wickets Int      @default(0)
  best_bowling_runs    Int      @default(9999)

  // Fielding
  catches              Int      @default(0)
  run_outs             Int      @default(0)
  stumpings            Int      @default(0)

  player               Player   @relation(fields: [player_id], references: [id], onDelete: Cascade)

  updated_at           DateTime @updatedAt

  @@schema("scoring")
}

model MatchEvent {
  id          String   @id @default(uuid()) @db.Uuid
  match_id    String   @db.Uuid
  team_id     String?  @db.Uuid
  player_id   String?  @db.Uuid
  event_type  String   // "goal","yellow_card","red_card","substitution","point","timeout"
  minute      Int?
  period      String?  // "1st_half","2nd_half","Q1","Q2","extra_time"
  value       Int      @default(1)
  description String?

  // Season/year for future partitioning (Phase 0 seam — free now, expensive to retrofit later)
  season      String?
  year        Int?

  match       Match    @relation(fields: [match_id], references: [id], onDelete: Cascade)

  created_at  DateTime @default(now())

  @@index([match_id])
  @@schema("scoring")
}
```

- [ ] **Step 2: Validate the merged schema offline**

Run: `cd database && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀` — no `P1012` errors. If a `missing @@schema` or `missing opposite relation` error appears, it means a model was missed; the "Facts Verified" section above documents exactly what triggers each error.

- [ ] **Step 3: Generate the Prisma Client locally (no DB needed) to confirm the schema round-trips through the full client generator, not just the parser**

Run: `cd database && npx prisma generate`
Expected: `✔ Generated Prisma Client ... to ./node_modules/@prisma/client`, zero errors.

- [ ] **Step 4: Commit**

```bash
git add database/prisma/schema.prisma
git commit -m "feat(db): merge scoring schema into main Prisma schema under multiSchema"
```

---

### Task 2: Generate the scoring-schema migration SQL (offline, no live DB touch)

**Files:**
- Create: `database/prisma/migrations/<timestamp>_merge_scoring_schema/migration.sql`
- Create (scratch, delete after): a temporary scoring-only schema file used only to produce a clean diff

**Interfaces:**
- Consumes: `database/prisma/schema.prisma` from Task 1
- Produces: a migration.sql file the user will review and apply themselves (per their explicit choice) — must contain ONLY `CREATE SCHEMA "scoring"`, the 13 `CREATE TABLE "scoring".*` statements, and the cross-schema foreign keys. Must NOT contain any `DROP TABLE`/`CREATE TABLE` for any existing `public` table.

- [ ] **Step 1: Write a temporary scoring-only schema for diffing**

Create `database/prisma/scoring_only_temp.prisma` (temporary, deleted in Step 4):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["public", "scoring"]
}

// Stub only — the real User table already exists physically in "public".
// This stub exists purely so Prisma can validate/emit the cross-schema FK.
model User {
  id                  String       @id @db.Uuid
  scoring_tournaments Tournament[]
  @@schema("public")
}
```

Then append every scoring model/enum from the final merged schema in Task 1 (the block between `// ══...Scoring domain...══` and end of file) unchanged.

- [ ] **Step 2: Generate the diff script offline**

Run:
```bash
cd database
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/scoring_only_temp.prisma \
  --script \
  --output prisma/scoring_only_diff.sql
```
Expected output file starts with `-- CreateSchema` / `CREATE SCHEMA IF NOT EXISTS "public";` followed by `CREATE SCHEMA IF NOT EXISTS "scoring";`, then 13 `CREATE TABLE "scoring"."<Model>"` blocks, then `-- AddForeignKey` statements. No `public."User"` table creation should appear in the final saved migration (removed in Step 3) since it already exists live.

- [ ] **Step 3: Hand-verify and finalize the migration file**

Read `database/prisma/scoring_only_diff.sql`, delete the two lines:
```sql
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
```
and the `CREATE TABLE "public"."User" (...)` block (the stub table — must not be created against the real DB, the real `User` table already exists). Keep everything else. Save the result as:

`database/prisma/migrations/<YYYYMMDDHHMMSS>_merge_scoring_schema/migration.sql`

(use the actual current timestamp, later than `20260704190000_add_athlete_tournaments`, e.g. `20260705120000_merge_scoring_schema`)

Add a header comment to the top of the final `migration.sql`:
```sql
-- Phase 0 (docs/SCALING_PLAN.md): merges the scoring backend's tables into
-- the main database under a "scoring" Postgres schema. No data migration —
-- scoring has no production data yet. Apply with:
--   cd database && npx prisma migrate resolve --applied <this-folder-name>
--   (if already applied manually) or `npx prisma migrate deploy` if not.
```

- [ ] **Step 4: Delete the temporary diffing artifacts**

```bash
rm database/prisma/scoring_only_temp.prisma database/prisma/scoring_only_diff.sql
```

- [ ] **Step 5: Confirm migration folder naming matches Prisma's convention so `prisma migrate deploy` picks it up in order**

Run: `ls database/prisma/migrations | sort | tail -3`
Expected: the new `..._merge_scoring_schema` folder sorts after `20260704190000_add_athlete_tournaments`.

- [ ] **Step 6: Commit**

```bash
git add database/prisma/migrations/
git commit -m "feat(db): add scoring-schema migration SQL (not yet applied — see migration header)"
```

**Do not run this migration against the shared DATABASE_URL/DIRECT_URL. Hand off to the user to review and apply.**

---

### Task 3: Retire scoring's local login; make SSO stateless

**Files:**
- Modify: `scoring/backend/src/modules/auth/auth.routes.ts`
- Modify: `scoring/backend/src/modules/auth/auth.service.ts`

**Interfaces:**
- Produces: `POST /api/auth/sso` only — verifies a main-app access token and returns `{ user: { id, email, full_name, role }, access_token }` (no `refresh_token`, no DB writes).

- [ ] **Step 1: Rewrite `auth.service.ts`**

```typescript
import jwt from "jsonwebtoken";
import { Unauthorized } from "../../utils/errors";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";
const ACCESS_TTL = "15m";

if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

function signAccess(user: { id: string; role: string; email: string; name: string }) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
}

// Exchanges a valid main Sportivox access token for a scoring-scoped JWT.
// Stateless: no DB row is created or read. `sub` on the returned token is
// the same main User.id — every scoring table FKs straight to it.
export function ssoFromMainToken(mainToken: string) {
  if (!MAIN_JWT_SECRET) throw Unauthorized("SSO not configured");

  let claims: any;
  try {
    claims = jwt.verify(mainToken, MAIN_JWT_SECRET);
  } catch {
    throw Unauthorized("Invalid or expired Sportivox token");
  }

  if (claims.type !== "access") throw Unauthorized("Invalid token type");
  if (!claims.email || !claims.sub) throw Unauthorized("Token missing required claims");

  const user = {
    id: claims.sub as string,
    email: (claims.email as string).toLowerCase(),
    full_name: (claims.name as string) ?? claims.email,
    role: (claims.role as string) ?? "athlete",
  };

  const access_token = signAccess({ id: user.id, role: user.role, email: user.email, name: user.full_name });

  return { user, access_token };
}
```

- [ ] **Step 2: Rewrite `auth.routes.ts`**

```typescript
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/errors";
import * as svc from "./auth.service";

const router = Router();

// SSO — exchange a valid Sportivox main-app JWT for a scoring JWT (no password, no local account)
router.post("/sso", asyncHandler(async (req: any, res: any) => {
  const { main_token } = z.object({ main_token: z.string() }).parse(req.body);
  const r = svc.ssoFromMainToken(main_token);
  res.json(r);
}));

export default router;
```

- [ ] **Step 3: Verify no other code still imports the deleted exports**

Run: `grep -rn "svc.signup\|svc.login\|svc.refresh\|svc.logout\|from \"./auth.service\"" scoring/backend/src`
Expected: only `auth.routes.ts` imports `auth.service`, and only `ssoFromMainToken` is referenced.

- [ ] **Step 4: Build check**

Run: `cd scoring/backend && npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add scoring/backend/src/modules/auth/
git commit -m "feat(scoring-auth): retire local signup/login, make SSO exchange stateless"
```

---

### Task 4: Simplify scoring's auth middleware (no more shadow-user DB writes)

**Files:**
- Modify: `scoring/backend/src/middleware/auth.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `req.user: { sub: string; role: string; email: string }` where `sub` is directly the main `User.id` for both token kinds — no DB round trip.

- [ ] **Step 1: Rewrite `scoring/backend/src/middleware/auth.ts`**

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Unauthorized } from "../utils/errors";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";

if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Accepts either a scoring-issued JWT (from /auth/sso) or a main Sportivox
// JWT directly — both carry `sub` = the main User.id, so no DB lookup is
// needed to resolve identity (scoring tables FK straight to main User.id).
function resolvePayload(token: string): JwtPayload | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    return { sub: p.sub, role: p.role, email: p.email };
  } catch {}

  if (MAIN_JWT_SECRET) {
    try {
      const c = jwt.verify(token, MAIN_JWT_SECRET) as any;
      if (c.type !== "access") return null;
      return { sub: c.sub, role: c.role ?? "athlete", email: c.email };
    } catch {}
  }

  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Unauthorized("Missing token"));

  const payload = resolvePayload(header.slice(7));
  if (!payload) return next(Unauthorized("Invalid or expired token"));
  req.user = payload;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const payload = resolvePayload(header.slice(7));
  if (payload) req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role) && req.user.role !== "admin") return next(Unauthorized("Insufficient permissions"));
    next();
  };
}
```

Note: `requireRole` now always lets `role === "admin"` through even if a call site forgets to list it explicitly — matching CLAUDE.md Master Rule #1, which every existing call site already satisfied manually but is now enforced centrally too.

- [ ] **Step 2: Confirm scoring.service.ts needs no changes**

Run: `grep -n "created_by\|req.user.sub" scoring/backend/src/modules/scoring/scoring.service.ts`
Expected: usages compare `t.created_by` against `req.user.sub` (a plain string comparison) — no model-name or shape changes needed since `req.user.sub` is already the correct main `User.id` string.

- [ ] **Step 3: Build check**

Run: `cd scoring/backend && npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add scoring/backend/src/middleware/auth.ts
git commit -m "refactor(scoring-auth): drop shadow-user DB lookup, decode main JWT claims directly"
```

---

### Task 5: Update ScoringGate.tsx and the scoring auth store

**Files:**
- Modify: `frontend/src/modules/live-scoring/pages/ScoringGate.tsx`
- Modify: `frontend/src/store/scoringAuth.ts`

**Interfaces:**
- Consumes: `POST /scoring-api/api/auth/sso` (unchanged endpoint shape from Task 3, minus `refresh_token`)
- Produces: `useScoringAuthStore.setSession(user, accessToken)` — two args, no refresh token

- [ ] **Step 1: Update `frontend/src/store/scoringAuth.ts`**

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../models";

/**
 * Stores the scoring-backend-specific JWT session.
 * The scoring backend runs separately and issues its own tokens via SSO
 * (ScoringGate exchanges the main Sportivox JWT for a scoring JWT).
 *
 * User identity is shared with the main auth store — we reuse the User model
 * rather than maintaining a parallel interface.
 */
interface ScoringAuthState {
  scoringUser:  User | null;
  accessToken:  string | null;
  setSession:   (user: User, accessToken: string) => void;
  clear:        () => void;
}

export const useScoringAuthStore = create<ScoringAuthState>()(
  persist(
    (set) => ({
      scoringUser:  null,
      accessToken:  null,
      setSession:   (scoringUser, accessToken) =>
        set({ scoringUser, accessToken }),
      clear: () =>
        set({ scoringUser: null, accessToken: null }),
    }),
    { name: "scoring-auth" }
  )
);
```

- [ ] **Step 2: Update `frontend/src/modules/live-scoring/pages/ScoringGate.tsx`**

Replace the manual-login fallback form with a message pointing back at the main app (no local scoring account exists anymore):

```tsx
import { useEffect, useState } from "react";
import { useAuthStore } from "../../../store/auth";
import { useScoringAuthStore } from "../../../store/scoringAuth";
import axios from "axios";
import { Target, Loader2 } from "lucide-react";

// Wraps all scoring pages.
// When a Sportivox user is logged in, auto-exchanges their JWT for a scoring JWT (SSO).
// There is no separate scoring account — if SSO fails, the fix is to log into Sportivox.
export default function ScoringGate({ children }: { children: React.ReactNode }) {
  const { scoringUser, setSession } = useScoringAuthStore();
  const { accessToken: mainToken } = useAuthStore();

  const [ssoState, setSsoState] = useState<"pending" | "done" | "failed">("pending");

  useEffect(() => {
    if (scoringUser) return;
    if (!mainToken) {
      setSsoState("failed");
      return;
    }

    axios
      .post("/scoring-api/api/auth/sso", { main_token: mainToken }, {
        headers: { "Content-Type": "application/json" }
      })
      .then(({ data }) => {
        setSession(data.user, data.access_token);
        setSsoState("done");
      })
      .catch(() => {
        setSsoState("failed");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (scoringUser) return <>{children}</>;

  if (ssoState === "pending") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-ink-sub">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          <p className="text-sm">Connecting to scoring console…</p>
        </div>
      </div>
    );
  }

  if (ssoState === "done") return null;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="card p-8 w-full max-w-sm space-y-4 text-center">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center mx-auto">
          <Target className="w-5 h-5 text-white" />
        </div>
        <p className="font-disp font-semibold text-lg text-ink">Scoring Console</p>
        <p className="text-sm text-ink-sub">
          You need to be signed in to Sportivox to use the scoring console.
        </p>
        <a href="/login" className="btn-primary w-full justify-center min-h-[44px] inline-flex items-center">
          Go to Sign In
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npm run typecheck`
Expected: exits 0, no references to the removed `refreshToken`/`setTokens`/manual-login form remain.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/live-scoring/pages/ScoringGate.tsx frontend/src/store/scoringAuth.ts
git commit -m "feat(scoring-frontend): remove manual scoring login, SSO-only gate"
```

---

### Task 6: Fix scoring seed scripts for the merged User shape

**Files:**
- Modify: `scoring/backend/prisma/seed.ts`
- Modify: `scoring/backend/prisma/seed-ipl2026-final.ts`

**Interfaces:**
- Consumes: merged `User` model (requires `email_lower`, `full_name_lower`, no `avatar_url` field — it's `profile_photo_url`)

- [ ] **Step 1: Read the exact current admin-creation block in both files to get `adminEmail`/surrounding variable names**

Run: `sed -n '1,40p' scoring/backend/prisma/seed.ts` and the same for `seed-ipl2026-final.ts` (already read during planning — both use a local `adminEmail` const and `prisma.user.findUnique`/`create`).

- [ ] **Step 2: Replace the admin-user block in both files with:**

```typescript
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const hash = await bcrypt.hash("Admin@1234", 12);
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        email_lower: adminEmail,
        password_hash: hash,
        full_name: "Scoring Admin",
        full_name_lower: "scoring admin",
        role: "scorer",
      }
    });
  }
```

(Keep every other line in each file — team/player/match/innings seeding — unchanged; only the `admin` user block's `data` shape changes: add `email_lower`, `full_name_lower`, drop the old `role: "admin"` literal from scoring's retired `UserRole` enum in favor of main `Role`'s `"scorer"`, matching CLAUDE.md's demo account list which already documents `admin@scoring.local` as `(scoring subsystem only)` rather than a platform admin.)

- [ ] **Step 3: Confirm no remaining reference to the dropped scoring `UserRole` values (`"viewer"`) anywhere in the seed files**

Run: `grep -n '"viewer"' scoring/backend/prisma/seed.ts scoring/backend/prisma/seed-ipl2026-final.ts`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add scoring/backend/prisma/seed.ts scoring/backend/prisma/seed-ipl2026-final.ts
git commit -m "fix(scoring-seed): create merged-shape User row (email_lower/full_name_lower/role)"
```

---

### Task 7: Point scoring backend at the shared Prisma schema

**Files:**
- Delete: `scoring/backend/prisma/schema.prisma`, `scoring/backend/prisma/migrations/`
- Modify: `scoring/backend/package.json`
- Modify: `scoring/backend/Dockerfile`, `scoring/backend/Dockerfile.dev`

**Interfaces:**
- Produces: `scoring/backend`'s own generated `@prisma/client`, generated from the shared `database/prisma/schema.prisma` (mirrors `backend/package.json`'s existing `db:generate` convention exactly).

- [ ] **Step 1: Delete scoring's own schema and migration history**

```bash
rm -rf scoring/backend/prisma/schema.prisma scoring/backend/prisma/migrations
```

Keep `scoring/backend/prisma/seed.ts` and `seed-ipl2026-final.ts` — only the schema/migrations are deleted, not the whole `prisma/` directory.

- [ ] **Step 2: Add the copy-and-generate script to `scoring/backend/package.json`**

Add next to the existing `db:generate`/`db:push` scripts (keep `db:push`/`db:studio`/`db:seed` as-is, they still work once a local schema.prisma copy exists):

```json
    "db:generate": "node -e \"require('fs').copyFileSync('../../database/prisma/schema.prisma','./prisma/schema.prisma')\" && prisma generate",
```

Replace the old `"db:migrate": "prisma migrate dev"` line — scoring backend no longer owns its own migration history, remove that script entirely (migrations now run only from `database/`).

- [ ] **Step 3: Update `scoring/backend/Dockerfile`'s build stage**

Change:
```dockerfile
# Copy scoring database schema for Prisma generation
COPY scoring/backend/prisma ./prisma
```
to:
```dockerfile
# Copy shared database schema for Prisma generation
COPY database/prisma ./prisma
```

(This mirrors `backend/Dockerfile`'s build stage exactly — same source, same target path.)

- [ ] **Step 4: Update `scoring/backend/Dockerfile.dev`**

Change:
```dockerfile
COPY prisma ./prisma
RUN npx prisma generate
```
to:
```dockerfile
COPY prisma ./prisma
RUN npx prisma generate
```
Note: `Dockerfile.dev`'s build context is `./scoring/backend` (per `docker-compose.yml`'s `build.context: ./scoring/backend`), so it cannot `COPY database/prisma` directly (outside its build context). Instead, change `docker-compose.yml`'s `scoring-backend` service to build with context `.` (repo root) like the `api` service does, dockerfile `scoring/backend/Dockerfile.dev`, so `COPY database/prisma ./prisma` resolves — this edit is done together with Task 9's docker-compose changes; note it here so Dockerfile.dev's `COPY database/prisma ./prisma` line (changed from `COPY prisma ./prisma`) is consistent with that later context-root change.

Final `Dockerfile.dev`:
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY scoring/backend/package*.json ./
RUN npm install
COPY database/prisma ./prisma
RUN npx prisma generate
COPY scoring/backend/. .
EXPOSE 4000
CMD ["npm", "run", "dev"]
```

- [ ] **Step 5: Locally regenerate the client to confirm the copy step works**

Run:
```bash
cd scoring/backend
npm run db:generate
```
Expected: `prisma/schema.prisma` now exists (copied), `✔ Generated Prisma Client` succeeds, output path `../node_modules/.prisma/client` per the schema's `generator client { output = ... }` line (unchanged from the original scoring schema — verify it's still present in the merged file's generator block if scoring backend needs a distinct output path; since the merged schema now lives at `database/prisma/schema.prisma` and defines one shared generator block without a scoring-specific `output`, scoring backend's copied local `prisma/schema.prisma` will generate into its own local `node_modules/@prisma/client`/`.prisma/client` by default — same as `backend/`'s pattern. No extra `output` override needed.)

- [ ] **Step 6: Build check**

Run: `cd scoring/backend && npm run build`
Expected: exits 0 (uses the freshly generated client's types).

- [ ] **Step 7: Add the copied local schema/client artifacts to `.gitignore` if not already covered**

Run: `grep -n "prisma/schema.prisma\|^prisma/\|node_modules" scoring/backend/.gitignore 2>/dev/null || grep -n "prisma/schema.prisma\|^prisma/\|node_modules" .gitignore`
Expected: the copied `scoring/backend/prisma/schema.prisma` should be gitignored (mirroring how `backend/prisma/schema.prisma` is handled — verify by checking `backend/.gitignore` or root `.gitignore` for the same `prisma/schema.prisma` pattern already in place for `backend/`, and add the equivalent line for `scoring/backend/prisma/schema.prisma` if missing).

- [ ] **Step 8: Commit**

```bash
git add scoring/backend/package.json scoring/backend/Dockerfile scoring/backend/Dockerfile.dev
git rm -r scoring/backend/prisma/schema.prisma scoring/backend/prisma/migrations
git commit -m "feat(scoring-backend): generate Prisma client from the shared database schema"
```

(If `.gitignore` needed updating from Step 7, include it in this commit.)

---

### Task 8: Add Socket.io to scoring backend (Redis-adapter seam)

**Files:**
- Modify: `scoring/backend/package.json` (add `socket.io`, `ioredis`, `@socket.io/redis-adapter`, `@types/ioredis`)
- Create: `scoring/backend/src/lib/socket.ts`
- Modify: `scoring/backend/src/server.ts`

**Interfaces:**
- Produces: `initSocket(httpServer): void` — no rooms/events yet (no feature consumes it until Phase 2's live-match broadcast); just connection auth + the `REDIS_URL`-gated adapter seam per `docs/SCALING_PLAN.md` Phase 0.

- [ ] **Step 1: Add dependencies to `scoring/backend/package.json`**

Add to `dependencies`:
```json
    "socket.io": "^4.8.3",
    "ioredis": "^5.11.1",
    "@socket.io/redis-adapter": "^8.3.0",
```
Add to `devDependencies`:
```json
    "@types/ioredis": "^4.28.10",
```

- [ ] **Step 2: Install**

Run: `cd scoring/backend && npm install`
Expected: exits 0, `package-lock.json` updated.

- [ ] **Step 3: Create `scoring/backend/src/lib/socket.ts`**

```typescript
import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean);

let io: SocketServer | null = null;

function verifyToken(token: string): string | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    return p.sub;
  } catch {}
  if (MAIN_JWT_SECRET) {
    try {
      const c = jwt.verify(token, MAIN_JWT_SECRET) as any;
      if (c.type === "access") return c.sub;
    } catch {}
  }
  return null;
}

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  io = new SocketServer(httpServer, {
    cors: { origin: CORS_ORIGINS, credentials: true },
    transports: ["websocket", "polling"],
  });

  // ponytail: single-instance in-memory adapter today (service is pinned to
  // min/max-instances=1). Swap to multi-instance only when concurrent
  // connections approach ~15-20K or deploy-during-live-match becomes painful
  // (see docs/SCALING_PLAN.md Future-Scale Hooks table).
  if (process.env.REDIS_URL) {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { default: Redis } = await import("ioredis");
    const pub = new Redis(process.env.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace("Bearer ", "") ?? "");
    const userId = token ? verifyToken(token) : null;
    if (!userId) return next(new Error("Invalid token"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    // ponytail: no rooms/events yet — live-match broadcast is Phase 2 work.
    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}
```

- [ ] **Step 4: Wire it into `scoring/backend/src/server.ts`**

```typescript
import http from "http";
import { createApp } from "./app";
import { initSocket } from "./lib/socket";

const PORT = process.env.PORT || 4000;

const app = createApp();
const server = http.createServer(app);

initSocket(server).then(() => {
  server.listen(PORT, () => {
    console.log(`Scoring API running on http://localhost:${PORT}`);
  });
});
```

- [ ] **Step 5: Build check**

Run: `cd scoring/backend && npm run build`
Expected: exits 0.

- [ ] **Step 6: Runtime smoke check (no real Postgres needed — Socket.io init doesn't touch the DB)**

Run: `cd scoring/backend && PORT=4099 JWT_SECRET=test MAIN_JWT_SECRET=test CORS_ORIGIN=http://localhost:5173 node -e "require('./dist/server.js')"` after a `npm run build`, then in another shell `curl -s http://localhost:4099/healthz`
Expected: `{"ok":true,"service":"scoring-api"}` — confirms the server boots and listens with Socket.io attached without crashing (kill the process after).

- [ ] **Step 7: Commit**

```bash
git add scoring/backend/package.json scoring/backend/package-lock.json scoring/backend/src/lib/socket.ts scoring/backend/src/server.ts
git commit -m "feat(scoring-backend): add Socket.io with REDIS_URL-gated multi-instance adapter seam"
```

---

### Task 9: Update docker-compose.yml for the merged database

**Revised after Task 2**: while executing this plan, staging DB credentials were rotated mid-session (new Supabase project). Per the user's explicit decision at that point, `docker-compose.yml` no longer hardcodes the connection string in the tracked file — it uses `${DATABASE_URL}`/`${DIRECT_URL}` substitution instead, sourced from a root `.env` file (already created, gitignored — confirmed via `git check-ignore`). This deviates from this plan's original literal text (which hardcoded the string, matching the pre-rotation convention) but was an explicit, deliberate call given the credential rotation. Both `api` and `scoring-backend` now read from the same two variables — no more per-service hardcoded duplication.

**Files:**
- Modify: `docker-compose.yml`

**Interfaces:**
- Produces: `api` and `scoring-backend` services both reading `${DATABASE_URL}`/`${DIRECT_URL}` from the project-root `.env` (docker compose auto-loads a file literally named `.env` in the same directory as the compose file for `${VAR}` substitution — this is separate from the `environment:` block values passed into the container). No more standalone `scoring-db` Postgres container.

- [ ] **Step 1: Remove the `scoring-db` service block entirely**

Delete the whole `scoring-db:` service block and the `scoring_pgdata: {}` line from the `volumes:` section at the bottom.

- [ ] **Step 2: Update the `api` service's hardcoded connection string to `${VAR}` substitution**

Replace, inside the `api:` service's `environment:` block:
```yaml
      DATABASE_URL: postgresql://postgres.vrybsjdrftpoaexnffyv:Sportivox%402026@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
      DIRECT_URL: postgresql://postgres:Sportivox%402026@db.vrybsjdrftpoaexnffyv.supabase.co:5432/postgres?sslmode=require
```
with:
```yaml
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL}
```
(Leave every other line in the `api:` service's `environment:` block unchanged — only these two lines change.)

- [ ] **Step 3: Update the `scoring-backend` service**

Replace:
```yaml
  scoring-backend:
    build:
      context: ./scoring/backend
      dockerfile: Dockerfile.dev
    # No host port needed — web container reaches this via internal network as http://scoring-backend:4000
    # To expose for direct access/debugging: add "4001:4000" here (avoids conflict with local dev on 4000)
    environment:
      DATABASE_URL: postgresql://postgres:postgres@scoring-db:5432/scoring_db
      JWT_SECRET: dev-secret-change-in-prod
      MAIN_JWT_SECRET: dev-access-secret-change-me
      PORT: 4000
      CORS_ORIGIN: http://localhost:5173,http://localhost:5174
      NODE_ENV: development
    depends_on:
      scoring-db:
        condition: service_healthy
    volumes:
      - ./scoring/backend/src:/app/src
    command: sh -c "npx prisma db push --skip-generate && npm run dev"
```
with:
```yaml
  scoring-backend:
    build:
      context: .
      dockerfile: ./scoring/backend/Dockerfile.dev
    # No host port needed — web container reaches this via internal network as http://scoring-backend:4000
    # To expose for direct access/debugging: add "4001:4000" here (avoids conflict with local dev on 4000)
    environment:
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL}
      JWT_SECRET: dev-secret-change-in-prod
      MAIN_JWT_SECRET: dev-access-secret-change-me
      PORT: 4000
      CORS_ORIGIN: http://localhost:5173,http://localhost:5174
      NODE_ENV: development
    volumes:
      - ./scoring/backend/src:/app/src
    command: npm run dev
```

(Same DB as the `api` service — no `depends_on: scoring-db` anymore since there's no local Postgres container left; no more `prisma db push` at container start since migrations are managed centrally via `database/prisma/migrations`.)

- [ ] **Step 4: Validate the compose file parses and substitution resolves**

Run: `docker compose config --quiet`
Expected: exits 0, no YAML/schema errors, no "variable is not set" warnings for `DATABASE_URL`/`DIRECT_URL` (confirms the root `.env` is being picked up).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(docker-compose): use \${DATABASE_URL}/\${DIRECT_URL} substitution, drop scoring-db container"
```

**Do not add or modify the root `.env` file in this task — it already exists (created directly by the controller earlier in this session, contains live staging credentials) and must not be read, printed, or echoed by an implementer.**

---

### Task 10: Update Terraform (remove scoring DB variables)

**Files:**
- Modify: `infra/terraform/variables.tf`
- Modify: `infra/terraform/cloudrun.tf`

**Interfaces:**
- Produces: scoring Cloud Run service's `DATABASE_URL`/`DIRECT_URL` env vars sourced from `var.database_url`/`var.direct_url` directly (same variables the main `api` service already uses).

- [ ] **Step 1: Remove the two variables from `infra/terraform/variables.tf`**

Delete (lines ~253-265):
```hcl
variable "scoring_database_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "PostgreSQL connection URL for the scoring database (pooler, port 6543)."
}

variable "scoring_direct_url" {
  type        = string
  sensitive   = true
  default     = ""
  description = "PostgreSQL direct connection URL for the scoring database (port 5432). Used by Prisma for migrations."
}
```

- [ ] **Step 2: Update `infra/terraform/cloudrun.tf`'s scoring service env block**

Change (around line 246-253):
```hcl
      env {
        name  = "DATABASE_URL"
        value = var.scoring_database_url != "" ? var.scoring_database_url : var.database_url
      }
      env {
        name  = "DIRECT_URL"
        value = var.scoring_direct_url != "" ? var.scoring_direct_url : var.direct_url
      }
```
to:
```hcl
      env {
        name  = "DATABASE_URL"
        value = var.database_url
      }
      env {
        name  = "DIRECT_URL"
        value = var.direct_url
      }
```

- [ ] **Step 3: Terraform format + validate (local, no state/backend access needed)**

Run: `cd infra/terraform && terraform fmt -check && terraform validate`
Expected: `terraform validate` reports `Success! The configuration is valid.` (this only checks HCL syntax/references, does not need cloud credentials or backend state).

- [ ] **Step 4: Confirm no other file still references the removed variables**

Run: `grep -rn "scoring_database_url\|scoring_direct_url" infra/ .github/`
Expected: no matches after Task 11 also updates the CI workflows — if this task runs before Task 11, matches in `.github/workflows/*.yml` are expected and handled there.

- [ ] **Step 5: Commit**

```bash
git add infra/terraform/variables.tf infra/terraform/cloudrun.tf
git commit -m "chore(terraform): scoring Cloud Run service uses the shared database_url/direct_url"
```

---

### Task 11: Update CI workflows (remove the separate scoring migration job)

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`
- Modify: `.github/workflows/deploy-production.yml`

**Interfaces:**
- Produces: a single `migrate-main-db` job (already existing) as the only migration step; `deploy` job's `needs:` list drops `migrate-scoring-db`; Terraform invocations drop the `scoring_database_url`/`scoring_direct_url` vars.

- [ ] **Step 1: In `deploy-staging.yml`, delete the entire `migrate-scoring-db` job** (lines 70-112)

- [ ] **Step 2: In `deploy-staging.yml`, remove `migrate-scoring-db` from the `deploy` job's `needs:` list** (around line 235-240)

Change:
```yaml
    needs:
      - migrate-main-db
      - migrate-scoring-db
      - build-api
      - build-web
      - build-scoring-api
```
to:
```yaml
    needs:
      - migrate-main-db
      - build-api
      - build-web
      - build-scoring-api
```

- [ ] **Step 3: In `deploy-staging.yml`, remove `-var="scoring_database_url=..."` and `-var="scoring_direct_url=..."` from all three `terraform import`/`plan` invocations** (the "Import existing scoring Cloud Run service", "Import existing DIRECT_URL secret", and "Terraform Plan" steps)

Each occurrence of:
```yaml
            -var="scoring_database_url=${{ secrets.SCORING_DATABASE_URL }}" \
            -var="scoring_direct_url=${{ secrets.SCORING_DIRECT_URL }}" \
```
is deleted (3 occurrences in this file).

- [ ] **Step 4: Repeat Steps 1-3 for `deploy-production.yml`**
- Delete the `migrate-scoring-db` job (lines 93-136)
- Remove `migrate-scoring-db` from `approve-deploy`'s `needs:` list (around line 262-268)
- Remove the two `-var="scoring_database_url=..."`/`-var="scoring_direct_url=..."` lines from the `terraform import`/`plan` steps (2 occurrences in this file)

- [ ] **Step 5: Validate YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-staging.yml')); yaml.safe_load(open('.github/workflows/deploy-production.yml')); print('OK')"`
Expected: `OK` (if Python/PyYAML isn't available, use `node -e "require('js-yaml').loadAll(require('fs').readFileSync('.github/workflows/deploy-staging.yml','utf8'))"` or equivalent — either way, confirm both files still parse as valid YAML after the edits).

- [ ] **Step 6: Confirm zero remaining references**

Run: `grep -rn "SCORING_DATABASE_URL\|SCORING_DIRECT_URL\|migrate-scoring-db\|scoring_database_url\|scoring_direct_url" .github/ infra/`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/deploy-staging.yml .github/workflows/deploy-production.yml
git commit -m "ci: fold scoring DB migrations into the single main-db migration job"
```

(The `SCORING_DATABASE_URL`/`SCORING_DIRECT_URL` GitHub Actions secrets themselves become unused after this — flag to the user to remove them from repo/environment secrets later; not something this plan can do, it's a GitHub UI action outside repo files.)

---

### Task 12: Update env examples and final verification

**Files:**
- Modify: `scoring/backend/.env.example`

**Interfaces:**
- None — final integration check.

- [ ] **Step 1: Update `scoring/backend/.env.example`**

Replace:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/scoring_db"
JWT_SECRET="change-this-to-a-long-random-secret"
PORT=4000
CORS_ORIGIN="http://localhost:5174"
NODE_ENV=development
```
with:
```
# Shares the main Sportivox database (scoring tables live under the "scoring"
# Postgres schema, see database/prisma/schema.prisma) — use the same value as
# backend/.env.example's DATABASE_URL/DIRECT_URL.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sportivox"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/sportivox"
JWT_SECRET="change-this-to-a-long-random-secret"
MAIN_JWT_SECRET="must-match-backend's-JWT_ACCESS_SECRET"
PORT=4000
CORS_ORIGIN="http://localhost:5174"
NODE_ENV=development

# Redis (optional — leave blank for single-instance Socket.io, no cross-instance adapter)
# REDIS_URL=redis://localhost:6379
```

- [ ] **Step 2: Confirm Supabase's built-in Supavisor pooler is in use (Phase 0's stated "no custom PgBouncer needed at 10K" check)**

Run: `grep -o "pgbouncer=true" docker-compose.yml backend/.env.example scoring/backend/.env.example`
Expected: at least one match on the pooled `DATABASE_URL` (port `6543`) — confirms transaction-pooled connections already flow through Supabase's Supavisor, not a custom pooler. If missing anywhere `DATABASE_URL` is defined, flag it in the final report rather than silently adding one (connection-string changes are the user's to approve).

- [ ] **Step 3: Full verification sweep**

Run each and confirm zero errors:
```bash
cd database && npx prisma validate && npx prisma generate
cd ../frontend && npm run typecheck && npm run build
cd ../backend && npm run typecheck
cd ../scoring/backend && npm run build
```

- [ ] **Step 4: Confirm no leftover references anywhere in the repo**

Run: `grep -rln "SCORING_DATABASE_URL\|SCORING_DIRECT_URL\|scoring_database_url\|scoring_direct_url" --include="*.ts" --include="*.tf" --include="*.yml" --include="*.yaml" .`
Expected: no matches (excluding this plan document itself and `docs/SCALING_PLAN.md`, which describe the change historically).

- [ ] **Step 5: Confirm scoring backend's own schema/migrations are gone and it builds from the shared one**

Run: `test ! -f scoring/backend/prisma/schema.prisma && echo "gitignored/deleted OK" ; test ! -d scoring/backend/prisma/migrations && echo "migrations deleted OK"`
(Note: Step 1 of Task 7 deleted the tracked file; Task 7 Step 5's `npm run db:generate` will have re-created a local, gitignored copy — that's expected and correct, mirroring `backend/prisma/schema.prisma`'s own gitignored local copy.)

- [ ] **Step 6: Commit**

```bash
git add scoring/backend/.env.example
git commit -m "docs(scoring-backend): document shared DATABASE_URL/DIRECT_URL and optional REDIS_URL"
```

---

## Final Report To User (say this explicitly, don't skip)

After all 12 tasks are done, tell the user, in plain terms:
1. The migration SQL is generated but **not applied** — point them at the exact file path from Task 2 and remind them how to apply it (`prisma migrate deploy` from `database/`, or `prisma migrate resolve --applied <folder>` if they run the SQL by hand against Supabase directly).
2. `admin@scoring.local` is no longer a separate scoring-only account — it needs to exist as a real Sportivox `User` (role `scorer` or `admin`) for anyone to reach the scoring console via SSO. The seed scripts (Task 6) create it with role `scorer`; if they want a different demo email/role, say so before they run `db:seed`.
3. The `SCORING_DATABASE_URL`/`SCORING_DIRECT_URL` GitHub Actions secrets are now unused — they should remove them from repo/environment settings whenever convenient (not something this plan touches, it's outside the repo).
4. Their own scoring backend `.env`/`.env.local` (not `.env.example`) still points at the old separate scoring Postgres — they'll need to update it locally to the shared `DATABASE_URL`/`DIRECT_URL` before running scoring backend locally again.
