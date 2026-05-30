# Setup and seed local PostgreSQL database for Sportivox development
# Usage: .\scripts\seed-local-db.ps1
# Prerequisites: Docker Desktop must be running

param(
    [switch]$SkipDocker = $false,
    [switch]$SkipMigrate = $false,
    [switch]$CleanStart = $false
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "🚀 Sportivox Local Database Setup" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# 1. Docker Postgres
if (-not $SkipDocker) {
    Write-Host "📦 Step 1: Starting PostgreSQL in Docker..." -ForegroundColor Yellow
    Set-Location $RootDir

    if ($CleanStart) {
        Write-Host "  ⚠️  Clean start: removing orphan containers..." -ForegroundColor Gray
        docker compose down --remove-orphans 2>&1 | Out-Null
    }

    $postgresUp = docker compose up postgres --wait -d 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ PostgreSQL is running" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to start PostgreSQL" -ForegroundColor Red
        exit 1
    }
}

# 2. Generate Prisma Client
Write-Host ""
Write-Host "🔧 Step 2: Generating Prisma Client..." -ForegroundColor Yellow
Set-Location "$RootDir\backend"

$prismaGen = npx prisma generate --schema=../database/prisma/schema.prisma 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Prisma Client generated" -ForegroundColor Green
} else {
    Write-Host "  ✗ Prisma generation failed" -ForegroundColor Red
    Write-Host $prismaGen
    exit 1
}

# 3. Push Schema to Database
if (-not $SkipMigrate) {
    Write-Host ""
    Write-Host "📋 Step 3: Syncing database schema..." -ForegroundColor Yellow

    $prismaPush = npx prisma db push --schema=../database/prisma/schema.prisma --skip-generate 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Database schema synced" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Schema sync failed" -ForegroundColor Red
        Write-Host $prismaPush
        exit 1
    }
}

# 4. Run Seed Script
Write-Host ""
Write-Host "🌱 Step 4: Seeding demo data..." -ForegroundColor Yellow

$seedOutput = npm run seed 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Demo data seeded successfully" -ForegroundColor Green
    # Extract summary from output
    $seedOutput | Select-String "accounts|password|login" | ForEach-Object {
        Write-Host "    $_" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ Seed failed" -ForegroundColor Red
    Write-Host $seedOutput
    exit 1
}

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Demo credentials:" -ForegroundColor Cyan
Write-Host "  Email:    arjun@demo" -ForegroundColor White
Write-Host "  Password: Demo1234!" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start dev server: npm run dev (from /backend)" -ForegroundColor Gray
Write-Host "  2. Start frontend:   npm run dev (from /frontend)" -ForegroundColor Gray
Write-Host "  3. Open browser:     http://localhost:5173" -ForegroundColor Gray
Write-Host ""
