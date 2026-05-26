# Sportivox

A multi-role sports networking & recruitment platform. Athletes, clubs, academies, scouts and organizers in one verified ecosystem.

> Built from the SRS/FRS in `../Sportivox_SRS_FRS_v1.docx` (EASOPS Technologies). This repo deviates from the SRS in two intentional ways: it deploys to **GCP** (not AWS) and uses **Firestore** (not MongoDB) — both decisions documented in `docs/ARCHITECTURE.md`.

## What's inside

| Path | Purpose |
|------|---------|
| `backend/` | Node.js + TypeScript + Express API, Firestore data layer, JWT auth, OpenAI integration |
| `frontend/` | React 18 + Vite + Tailwind web app, served by nginx in production |
| `infra/terraform/` | GCP Terraform — Cloud Run, Firestore, GCS, Secret Manager, IAM, Artifact Registry |
| `infra/cloudbuild.yaml` | Cloud Build pipeline: build, push, deploy |
| `.github/workflows/ci.yml` | GitHub Actions — typecheck, build, test on every push/PR |
| `docs/` | Architecture, deployment runbook, security controls reference, API surface |

## Features

All Phase-1 SRS modules **plus** the four additional requested features:

- Multi-role auth (Athlete / Club / Academy / Scout / Organizer / Admin) with JWT + refresh rotation, email verification, password reset
- Detailed athlete + organisation profiles with sport stats, achievements, document uploads
- Opportunity listings (trials, recruitment, scholarships, tournaments, coaching jobs)
- Application state machine — Pending → Shortlisted → Selected / Rejected / Withdrawn — with vacancy tracking and notifications
- Multi-filter search (players / clubs / opportunities) over Firestore indexes
- Async DM messaging with conversation threads + unread counts
- In-app + email notifications for every key event
- Verification workflow with Admin review and badge issuance
- OpenAI-powered athlete performance tips with per-user rate limiting
- Admin panel: user moderation, KYC review, badge management, abuse reports, full audit log, analytics
- **Activity logs / posts** — training logs + general updates with likes & comments
- **Reels** — short videos, Instagram-style feed
- **Blogs** — long-form markdown with cover images, draft/publish workflow
- **Follow / unfollow** users with denormalised counts and notifications
- GCS-backed media uploads via signed URLs (private docs + public media buckets)

## Quick start (local)

```bash
make install        # install backend + frontend deps
make dev            # start Firestore emulator + GCS emulator + api + web
make seed           # (optional) load demo users + an org + opportunity
```

Then open <http://localhost:5173>. Sign in with any seeded demo account using password `Demo1234!`:

- `admin@sportivox.local`
- `athlete@demo.sportivox`
- `club@demo.sportivox`
- `scout@demo.sportivox`

## Deploying to GCP

**👉 If you're the developer handed this repo for deployment, read [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) end-to-end.** It's a single, copy-paste-ready step-by-step guide covering prerequisites, GCP setup, image build, Terraform apply, custom domains, CI/CD, monitoring, backups, rollback, costs, and troubleshooting. Time budget: ~45 min for first deploy.

Cheat-sheet version of the happy path:

```bash
# 1. Build + push images to Artifact Registry
gcloud builds submit . --config infra/cloudbuild.yaml \
  --substitutions=_REGION=asia-south1,_AR_REPO=sportivox,_API_SERVICE=sportivox-api-prod,_WEB_SERVICE=sportivox-web-prod,_API_PUBLIC_URL=...,_WEB_APP_URL=...

# 2. Terraform creates Cloud Run, Firestore, buckets, secrets
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars && $EDITOR terraform.tfvars
terraform init && terraform apply
```

## Testing

```bash
make test           # backend Jest + Supertest + frontend Vitest
```

Backend tests require a running Firestore emulator. `make dev` brings one up; CI starts its own.

## Security

See `docs/SECURITY.md` for the full mapping of SRS Section 8 controls to implementation. Highlights:

- JWT access (15m) + rotating refresh (30d) — single-use, server-revocable
- bcrypt with 12+ salt rounds
- Helmet, CORS allowlist, rate limit (per IP, stricter for /auth)
- Server-side Zod validation on every input
- Signed time-limited URLs for private GCS docs; public bucket is read-only
- Full admin audit log
- RBAC enforced at every endpoint
- Logger redacts passwords/tokens

## License

Proprietary — © Sportivox / EASOPS Technologies PVT LTD. Strictly Confidential.
