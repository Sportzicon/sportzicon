# Seed Setup & Demo Data

Complete guide for setting up and seeding demo data for Sportivox local development.

## Quick Start

### Windows (PowerShell)

```powershell
cd f:\My Project\sportivox-main\sportivox-main
.\scripts\seed-local-db.ps1
```

### Mac/Linux

```bash
cd ~/path/to/sportivox-main
chmod +x ./scripts/seed-local-db.sh
./scripts/seed-local-db.sh
```

## What Gets Seeded

- **16 demo accounts**: Athletes, scouts, club managers, organizers
- **5 organizations**: Maharashtra State XI, Mumbai Strikers, DY Patil Academy, Margao FC, Pune Cricket League
- **2 opportunities**: Senior Men's Trial, Sports Scholarship 2026
- **Database**: Postgres schema fully migrated and synced

## Demo Credentials

```
Email:    arjun@demo
Password: Demo1234!
```

All demo accounts use the same password: `Demo1234!`

## What the Script Does

1. **Starts PostgreSQL** in Docker (`docker compose up postgres`)
2. **Generates Prisma Client** (`npx prisma generate`)
3. **Syncs Database Schema** (`npx prisma db push`)
4. **Seeds Demo Data** (`npm run seed`)

The seed script is **idempotent** — safe to run multiple times. It uses fixed deterministic IDs, so re-running will update existing records rather than duplicate them.

## Manual Steps

If you prefer to run commands individually:

### Step 1: Start PostgreSQL

```powershell
docker compose up postgres --wait -d
```

### Step 2: Generate Prisma Client

```powershell
cd backend
npx prisma generate --schema=../database/prisma/schema.prisma
```

### Step 3: Sync Database

```powershell
npx prisma db push --schema=../database/prisma/schema.prisma
```

### Step 4: Seed Demo Data

```powershell
npm run seed
```

## Database Details

- **Host**: localhost:5432
- **Database**: sportivox
- **User**: sportivox
- **Password**: localdev
- **Volume**: `postgres-data` (persists between restarts)

## Troubleshooting

### PostgreSQL won't start

```powershell
# Check if Docker is running
docker version

# Clean up previous containers
docker compose down --remove-orphans
docker compose up postgres --wait -d
```

### Prisma client error

```powershell
cd backend
npx prisma generate --schema=../database/prisma/schema.prisma
```

### Schema sync fails

```powershell
npx prisma db push --schema=../database/prisma/schema.prisma --skip-generate
```

### Reset database

```powershell
# Stop and remove postgres container
docker compose down

# Remove data volume
docker volume rm sportivox-main_postgres-data

# Recreate
docker compose up postgres --wait -d
npx prisma db push
npm run seed
```

## What's in the Seed Data

### Users (16 accounts)
- **Admin**: admin@sportivox.local
- **Athletes (9)**: Arjun (cricket all-rounder), Imran (fast bowler), Dev (opener), Kabir (keeper), Vikram (batter), Rohan (footballer), Sara (goalkeeper), Aditi (sprinter), Sahil (club player)
- **Scouts (2)**: Maya Iyer, Sandeep Joshi
- **Club/Org Managers (5)**: Mumbai Strikers, DY Patil Academy, Margao FC, Pune Cricket League

### Organizations (5)
- Maharashtra State XI (Cricket club)
- Mumbai Strikers (T20 franchise)
- DY Patil Academy (Multi-sport academy)
- Margao FC (Football club)
- Pune Cricket League (Tournament organizer)

### Opportunities (2)
1. **Senior Men's Trial** (Trial) - Maharashtra State XI
   - 6 vacancies, takes applications through 2026-06-03
2. **Sports Scholarship 2026** (Scholarship) - DY Patil Academy
   - 12 vacancies, takes applications through 2026-06-25

## Running the Application

After seeding:

### Terminal 1 - API (from `/backend`)

```powershell
npm run dev
# API runs on http://localhost:8080
```

### Terminal 2 - Frontend (from `/frontend`)

```powershell
npm run dev
# Frontend runs on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

## Script Files

- `scripts/seed-local-db.ps1` — Windows PowerShell automation script
- `scripts/seed-local-db.sh` — Mac/Linux bash script
- `backend/src/scripts/seed.ts` — Prisma seed script (idempotent demo data)

All scripts are safe to run multiple times without duplication.

---

For more information, see [LOCAL_SETUP.md](./LOCAL_SETUP.md).
