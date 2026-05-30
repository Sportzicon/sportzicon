# Firestore → PostgreSQL Migration Plan

## Overview

This document is a ready-to-execute plan for migrating Sportivox from Firestore to PostgreSQL.
Nothing here is implemented yet — this is a reference for when the team decides to migrate.

**Why PostgreSQL:**
- The data model is relational (users → orgs → opportunities → applications)
- Complex filtering (sport + city + age + type) requires SQL, not Firestore workarounds
- PostGIS extension enables real geo-radius search (currently not functional)
- Full-text search built-in (replaces basic keyword matching)
- No composite index management
- ACID transactions for counters, application status changes

**ORM: Prisma**
- Single schema file generates typed client
- Works with PostgreSQL, MySQL, SQLite, CockroachDB — one schema, swap the datasource
- Auto-generates and runs migrations
- Full TypeScript support, no manual type definitions needed

---

## Phase 1 — Infrastructure (Terraform)

### Add to `infra/terraform/cloudsql.tf` (new file):

```hcl
resource "google_sql_database_instance" "postgres" {
  name             = "sportivox-pg-${var.env}"
  database_version = "POSTGRES_15"
  region           = var.region
  deletion_protection = true

  settings {
    tier              = "db-f1-micro"   # ~$7/month — upgrade for production load
    availability_type = "ZONAL"         # change to REGIONAL for HA

    backup_configuration {
      enabled    = true
      start_time = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false           # private IP only
      private_network = "projects/${var.project_id}/global/networks/default"
    }
  }
}

resource "google_sql_database" "app" {
  name     = "sportivox"
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = "sportivox"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "sportivox-db-password-${var.env}"
  replication { auto {} }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Cloud Run connects via Cloud SQL Auth Proxy (built-in connector)
resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${data.google_service_account.runtime.email}"
}
```

### Update `infra/terraform/cloudrun.tf`:
Add to the API service container env vars:
```hcl
env {
  name  = "DATABASE_URL"
  value = "postgresql://sportivox:${random_password.db_password.result}@localhost/sportivox?host=/cloudsql/${var.project_id}:${var.region}:sportivox-pg-${var.env}"
}
```

Add Cloud SQL connection to the API service template:
```hcl
template {
  ...
  volumes {
    name = "cloudsql"
    cloud_sql_instance {
      instances = [google_sql_database_instance.postgres.connection_name]
    }
  }
  containers {
    ...
    volume_mounts {
      name       = "cloudsql"
      mount_path = "/cloudsql"
    }
  }
}
```

### APIs to enable (add to `main.tf` required_apis):
```
"sqladmin.googleapis.com"
"servicenetworking.googleapis.com"
```

---

## Phase 2 — Prisma Schema

### File: `backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  athlete
  club
  scout
  organizer
  admin
}

enum AccountStatus {
  active
  suspended
  pending
}

enum VerificationStatus {
  unverified
  pending
  approved
  rejected
}

enum OpportunityType {
  trial
  recruitment
  scholarship
  tournament
  coaching_job
}

enum OpportunityStatus {
  open
  closed
  filled
}

enum ApplicationStatus {
  pending
  shortlisted
  selected
  rejected
  withdrawn
}

model User {
  id                String        @id @default(cuid())
  email             String        @unique
  email_lower       String        @unique
  email_verified    Boolean       @default(false)
  phone             String?
  phone_verified    Boolean       @default(false)
  password_hash     String
  full_name         String
  full_name_lower   String
  role              Role
  status            AccountStatus @default(active)
  bio               String?       @db.Text
  profile_photo_url String?
  cover_photo_url   String?
  country           String?
  state             String?
  city              String?
  dob               String?
  gender            String?
  preferred_language String?

  verification_status  VerificationStatus @default(unverified)
  verification_badges  String[]           @default([])

  athlete_data  Json?   // stores AthleteProfile as JSONB
  coach_data    Json?   // stores CoachProfile as JSONB

  follower_count  Int @default(0)
  following_count Int @default(0)

  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  last_active_at DateTime @default(now())

  organizations   Organization[]
  opportunities   Opportunity[]   @relation("PostedBy")
  applications    Application[]
  posts           Post[]
  reels           Reel[]
  blogs           Blog[]
  comments        Comment[]
  messages_sent   Message[]       @relation("Sender")
  notifications   Notification[]
  followers       Follow[]        @relation("Followee")
  following       Follow[]        @relation("Follower")
  reports_made    Report[]        @relation("Reporter")
  audit_logs      AuditLog[]
}

model Organization {
  id                   String             @id @default(cuid())
  owner_user_id        String
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

  owner        User          @relation(fields: [owner_user_id], references: [id])
  opportunities Opportunity[]
}

model Opportunity {
  id                         String            @id @default(cuid())
  org_id                     String
  posted_by_user_id          String
  title                      String
  title_lower                String
  type                       OpportunityType
  sport                      String
  description                String            @db.Text
  eligibility                String?
  age_min                    Int
  age_max                    Int
  gender_eligibility         String            @default("all")
  experience_level_required  String            @default("any")
  country                    String
  state                      String
  city                       String
  start_date                 String
  end_date                   String
  application_deadline       String
  entry_fee                  Float?
  documents_required         String[]          @default([])
  vacancies                  Int?
  vacancies_filled           Int               @default(0)
  contact_email              String?
  contact_phone              String?
  status                     OpportunityStatus @default(open)
  application_count          Int               @default(0)

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  organization Organization  @relation(fields: [org_id], references: [id])
  posted_by    User          @relation("PostedBy", fields: [posted_by_user_id], references: [id])
  applications Application[]

  @@index([status, sport, city])
  @@index([status, type])
  @@index([org_id])
}

model Application {
  id                 String            @id @default(cuid())
  opportunity_id     String
  applicant_user_id  String
  cover_note         String?           @db.Text
  documents          String[]          @default([])
  status             ApplicationStatus @default(pending)
  rejection_reason   String?
  history            Json              @default("[]")
  applied_at         DateTime          @default(now())
  updated_at         DateTime          @updatedAt

  opportunity Opportunity @relation(fields: [opportunity_id], references: [id])
  applicant   User        @relation(fields: [applicant_user_id], references: [id])

  @@unique([opportunity_id, applicant_user_id])
  @@index([applicant_user_id])
  @@index([opportunity_id])
}

model Follow {
  id          String   @id @default(cuid())
  follower_id String
  followee_id String
  created_at  DateTime @default(now())

  follower User @relation("Follower", fields: [follower_id], references: [id])
  followee User @relation("Followee", fields: [followee_id], references: [id])

  @@unique([follower_id, followee_id])
  @@index([followee_id])
}

model Post {
  id          String   @id @default(cuid())
  author_id   String
  type        String   @default("post")
  text        String   @db.Text
  media_urls  String[] @default([])
  sport       String?
  tags        String[] @default([])
  like_count  Int      @default(0)
  comment_count Int    @default(0)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  author   User      @relation(fields: [author_id], references: [id])
  comments Comment[]

  @@index([author_id, created_at(sort: Desc)])
}

model Reel {
  id               String   @id @default(cuid())
  author_id        String
  caption          String?
  video_url        String
  thumbnail_url    String?
  duration_seconds Int?
  sport            String?
  view_count       Int      @default(0)
  like_count       Int      @default(0)
  comment_count    Int      @default(0)
  created_at       DateTime @default(now())

  author   User      @relation(fields: [author_id], references: [id])
  comments Comment[]
}

model Blog {
  id              String   @id @default(cuid())
  author_id       String
  title           String
  slug            String   @unique
  cover_image_url String?
  excerpt         String   @db.Text
  body_markdown   String   @db.Text
  tags            String[] @default([])
  sport           String?
  status          String   @default("draft")
  like_count      Int      @default(0)
  comment_count   Int      @default(0)
  view_count      Int      @default(0)
  published_at    DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  author   User      @relation(fields: [author_id], references: [id])
  comments Comment[]

  @@index([status, published_at(sort: Desc)])
}

model Comment {
  id          String   @id @default(cuid())
  parent_type String   // "post" | "reel" | "blog"
  parent_id   String
  author_id   String
  text        String   @db.Text
  created_at  DateTime @default(now())

  author User  @relation(fields: [author_id], references: [id])
  post   Post? @relation(fields: [parent_id], references: [id], map: "comment_post")
  reel   Reel? @relation(fields: [parent_id], references: [id], map: "comment_reel")
  blog   Blog? @relation(fields: [parent_id], references: [id], map: "comment_blog")

  @@index([parent_type, parent_id, created_at(sort: Desc)])
}

model Conversation {
  id              String   @id @default(cuid())
  participant_ids String[]
  last_message    Json?
  unread_counts   Json     @default("{}")
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  messages Message[]

  @@index([participant_ids])
}

model Message {
  id              String   @id @default(cuid())
  conversation_id String
  sender_id       String
  recipient_id    String
  body            String   @db.Text
  read_at         DateTime?
  flagged         Boolean  @default(false)
  created_at      DateTime @default(now())

  conversation Conversation @relation(fields: [conversation_id], references: [id])
  sender       User         @relation("Sender", fields: [sender_id], references: [id])

  @@index([conversation_id, created_at(sort: Desc)])
}

model Notification {
  id         String   @id @default(cuid())
  user_id    String
  type       String
  title      String
  body       String
  link       String?
  read       Boolean  @default(false)
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])

  @@index([user_id, created_at(sort: Desc)])
  @@index([user_id, read])
}

model AuditLog {
  id          String   @id @default(cuid())
  actor_id    String
  actor_role  Role
  action      String
  target_type String?
  target_id   String?
  details     Json?
  ip          String?
  created_at  DateTime @default(now())

  actor User @relation(fields: [actor_id], references: [id])

  @@index([actor_id])
  @@index([created_at(sort: Desc)])
}

model Report {
  id           String   @id @default(cuid())
  reporter_id  String
  target_type  String
  target_id    String
  reason       String   @db.Text
  status       String   @default("open")
  resolved_by  String?
  resolved_at  DateTime?
  notes        String?
  created_at   DateTime @default(now())

  reporter User @relation("Reporter", fields: [reporter_id], references: [id])
}

model Verification {
  id                String             @id @default(cuid())
  entity_type       String
  entity_id         String
  verification_type String
  documents         String[]
  notes             String?
  status            VerificationStatus @default(pending)
  submitted_by      String
  reviewed_by       String?
  reviewed_at       DateTime?
  rejection_reason  String?
  created_at        DateTime           @default(now())
}
```

---

## Phase 3 — Code Migration Steps

### Step 1: Install dependencies
```bash
cd backend
npm install prisma @prisma/client
npm uninstall @google-cloud/firestore
npx prisma init
```

### Step 2: Replace `backend/src/config/firestore.ts`
Delete it. Replace all `import { db } from "../config/firestore"` with:
```ts
import { prisma } from "../config/prisma";
```

Create `backend/src/config/prisma.ts`:
```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
});
```

### Step 3: Update `backend/src/config/env.ts`
Add `DATABASE_URL` to the Zod schema:
```ts
DATABASE_URL: z.string().url()
```

### Step 4: Migrate each service module

| Module | Firestore pattern | Prisma equivalent |
|--------|------------------|-------------------|
| `auth.service.ts` | `db.collection("users").where("email_lower", "==", email)` | `prisma.user.findUnique({ where: { email_lower: email } })` |
| `users.service.ts` | `db.collection("users").doc(id).get()` | `prisma.user.findUnique({ where: { id } })` |
| `organizations.service.ts` | `db.collection("orgs").where("owner_user_id", "==", id)` | `prisma.organization.findMany({ where: { owner_user_id: id } })` |
| `opportunities.service.ts` | `db.collection("opportunities").where(...).get()` | `prisma.opportunity.findMany({ where: {...}, orderBy: { created_at: "desc" } })` |
| `follow.service.ts` | In-memory sort workaround | `prisma.follow.findMany({ where: { followee_id: id }, orderBy: { created_at: "desc" } })` |
| `search.service.ts` | Firestore equality filters | Full SQL `WHERE` with `ILIKE`, `AND`, `OR` |

### Step 5: Update Docker Compose for local dev
Replace Firestore emulator with PostgreSQL:
```yaml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sportivox
      POSTGRES_USER: sportivox
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"

  api:
    environment:
      DATABASE_URL: postgresql://sportivox:localdev@postgres:5432/sportivox
      # remove FIRESTORE_EMULATOR_HOST
```

### Step 6: Add Prisma to Dockerfile
```dockerfile
# In build stage, after npm install:
RUN npx prisma generate

# In runtime entrypoint — run migrations on startup:
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
```

---

## Phase 4 — Data Migration Script

### File: `backend/src/scripts/migrate-firestore-to-postgres.ts`

High-level approach (implement when ready):
```
1. Connect to both Firestore (source) and PostgreSQL (destination)
2. For each collection, in order of dependencies:
   a. users          (no deps)
   b. organizations  (depends on users)
   c. opportunities  (depends on organizations, users)
   d. applications   (depends on opportunities, users)
   e. follows        (depends on users)
   f. posts          (depends on users)
   g. reels          (depends on users)
   h. blogs          (depends on users)
   i. comments       (depends on posts/reels/blogs, users)
   j. conversations  (depends on users)
   k. messages       (depends on conversations, users)
   l. notifications  (depends on users)
3. Preserve original IDs (Firestore string IDs → PostgreSQL String @id)
4. Convert epoch ms timestamps → DateTime
5. Log progress and any failed records
6. Run in batches of 100 to avoid memory issues
```

---

## Phase 5 — Deployment Strategy

### Zero-downtime migration approach:

```
Week 1: Dual setup
  - Deploy Cloud SQL instance (Terraform)
  - Run Prisma migrations
  - Keep Firestore running (no changes to production yet)

Week 2: Data migration
  - Run migration script against production Firestore → PostgreSQL
  - Verify row counts and spot-check data
  - Test new API endpoints against PostgreSQL in staging

Week 3: Cutover
  - Deploy new backend (Prisma) to Cloud Run
  - Monitor error rates for 24 hours
  - If stable: shut down Firestore read/write
  - If issues: rollback to previous Cloud Run revision (instant in Cloud Run)

Week 4: Cleanup
  - Remove Firestore resources from Terraform
  - Delete emulator from docker-compose
  - Archive migration script
```

### Rollback:
Cloud Run keeps previous revisions. If the new backend has issues:
```bash
gcloud run services update-traffic sportivox-api-prod \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=asia-south1 \
  --project=sportivox-app
```
Instant — no data loss since Firestore is still intact during cutover week.

---

## Effort Estimate

| Phase | Effort |
|-------|--------|
| Terraform (Cloud SQL) | 2–3 hours |
| Prisma schema + migration files | 2–3 hours |
| Rewrite service modules | 3–5 days |
| Update Docker Compose + Dockerfiles | 2–3 hours |
| Data migration script | 1–2 days |
| Testing + QA | 2–3 days |
| Deployment + monitoring | 1 day |
| **Total** | **~2 weeks** |

---

## Files to Create/Modify When Ready

### New files:
- `backend/prisma/schema.prisma`
- `backend/src/config/prisma.ts`
- `backend/src/scripts/migrate-firestore-to-postgres.ts`
- `infra/terraform/cloudsql.tf`

### Modified files:
- `backend/src/config/env.ts` — add DATABASE_URL
- `backend/src/modules/*/**.service.ts` — replace Firestore with Prisma (all modules)
- `backend/Dockerfile` — add prisma generate + migrate deploy
- `docker-compose.yml` — replace firestore emulator with postgres
- `infra/terraform/cloudrun.tf` — add Cloud SQL connection + DATABASE_URL env
- `infra/terraform/main.tf` — add sqladmin.googleapis.com API
- `infra/terraform/terraform.tfvars.staging` — no changes needed
- `.gitignore` — ignore prisma migrations lock file if needed

### Deleted files:
- `backend/src/config/firestore.ts`
- `backend/src/config/storage.ts` (keep if GCS is still used for media)

---

## Notes

- GCS (media uploads) stays as-is — only the database changes
- PostGIS for geo-radius search: add `postgis` extension to Cloud SQL and update search service
- Full-text search: use PostgreSQL `tsvector` + `tsquery` or `ILIKE` for simple cases
- The `env = "prod"` in `terraform.tfvars.staging` means Cloud SQL instance will be named `sportivox-pg-prod` — fix this when separating staging/prod properly
