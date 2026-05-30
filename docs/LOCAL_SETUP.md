# Local Development Setup

Quick setup guide for running Sportivox locally with PostgreSQL seeded demo data.

## Prerequisites

- **Docker Desktop** (running) — for PostgreSQL
- **Node.js** 20+
- **npm** 10+

## Setup (Windows PowerShell)

**Option 1: Automated Script (Recommended)**

```powershell
cd f:\My Project\sportivox-main\sportivox-main
.\scripts\seed-local-db.ps1
```

**Option 2: Manual Steps**

```powershell
# Step 1: Start PostgreSQL
docker compose up postgres --wait -d

# Step 2: Go to backend and install deps
cd backend
npm install

# Step 3: Generate Prisma client
npx prisma generate --schema=../database/prisma/schema.prisma

# Step 4: Sync database schema
npx prisma db push --schema=../database/prisma/schema.prisma

# Step 5: Seed demo data
npm run seed
```

## Setup (macOS / Linux)

**Option 1: Automated Script**

```bash
cd ~/path/to/sportivox-main
chmod +x ./scripts/seed-local-db.sh
./scripts/seed-local-db.sh
```

**Option 2: Manual Steps**

```bash
# Step 1: Start PostgreSQL
docker compose up postgres --wait -d

# Step 2: Go to backend
cd backend
npm install

# Step 3: Generate Prisma client
npx prisma generate --schema=../database/prisma/schema.prisma

# Step 4: Sync database schema
npx prisma db push --schema=../database/prisma/schema.prisma

# Step 5: Seed demo data
npm run seed
```

## Running the Dev Server

After setup completes:

**Terminal 1: Backend (from `/backend`)**

```powershell
npm run dev
# Backend runs on http://localhost:8080
```

**Terminal 2: Frontend (from `/frontend`)**

```powershell
npm run dev
# Frontend runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

## Login Credentials

**Admin Account:**
- Email: `admin@sportivox.local`
- Password: `Demo1234!`

**Demo Athlete:**
- Email: `arjun@demo`
- Password: `Demo1234!`

**Other Demo Accounts:**
All demo accounts use the same password: `Demo1234!`

Available emails:
- `arjun@demo` — Arjun Mehta (athlete, cricket all-rounder)
- `imran@demo` — Imran Qureshi (athlete, fast bowler)
- `maya@demo` — Maya Iyer (scout)
- `club@demo` — Mumbai Strikers Manager
- `academy@demo` — DY Patil Academy Director
- ... and 11 more athlete/scout/club/organizer accounts

## Database

- **Type:** PostgreSQL 15
- **Host:** localhost:5432
- **Database:** sportivox
- **User:** sportivox
- **Password:** localdev

Data lives in Docker volume `postgres-data`.

## Troubleshooting

### "Can't reach database server at localhost:5432"

Docker is not running or PostgreSQL failed to start:

```powershell
docker compose ps | Select-String postgres
# If not running:
docker compose up postgres --wait -d
```

### "Prisma client did not initialize"

Regenerate the client:

```powershell
npx prisma generate --schema=../database/prisma/schema.prisma
```

### "Unknown table 'public.User'"

Schema not synced to database:

```powershell
npx prisma db push --schema=../database/prisma/schema.prisma
```

### "API container won't start"

Rebuild the API Docker image:

```powershell
docker compose build api --no-cache
docker compose up api -d
```

## Re-seeding Data

To reset to fresh demo data:

```powershell
# Option 1: Just re-run seed (idempotent)
cd backend
npm run seed

# Option 2: Clean database and re-seed
docker compose down postgres-data
docker compose up postgres --wait -d
npx prisma db push --schema=../database/prisma/schema.prisma
npm run seed
```

## Next Steps

- Explore the frontend at http://localhost:5173
- Check API docs at http://localhost:8080/api-docs
- View database with: `docker exec sportivox-main-postgres-1 psql -U sportivox -d sportivox`

---

For issues or questions, see the project README.
