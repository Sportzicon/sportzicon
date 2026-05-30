#!/bin/bash
# Setup and seed local PostgreSQL database for Sportivox development
# Usage: ./scripts/seed-local-db.sh [--skip-docker] [--skip-migrate] [--clean-start]

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_DOCKER=false
SKIP_MIGRATE=false
CLEAN_START=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-docker) SKIP_DOCKER=true; shift ;;
        --skip-migrate) SKIP_MIGRATE=true; shift ;;
        --clean-start) CLEAN_START=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo "🚀 Sportivox Local Database Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Docker Postgres
if [ "$SKIP_DOCKER" = false ]; then
    echo "📦 Step 1: Starting PostgreSQL in Docker..."
    cd "$ROOT_DIR"

    if [ "$CLEAN_START" = true ]; then
        echo "  ⚠️  Clean start: removing orphan containers..."
        docker compose down --remove-orphans 2>/dev/null || true
    fi

    if docker compose up postgres --wait -d 2>&1 | grep -q "Started\|already\|Running"; then
        echo "  ✓ PostgreSQL is running"
    else
        echo "  ✗ Failed to start PostgreSQL"
        exit 1
    fi
fi

# 2. Generate Prisma Client
echo ""
echo "🔧 Step 2: Generating Prisma Client..."
cd "$ROOT_DIR/backend"

if npx prisma generate --schema=../database/prisma/schema.prisma > /dev/null 2>&1; then
    echo "  ✓ Prisma Client generated"
else
    echo "  ✗ Prisma generation failed"
    exit 1
fi

# 3. Push Schema to Database
if [ "$SKIP_MIGRATE" = false ]; then
    echo ""
    echo "📋 Step 3: Syncing database schema..."

    if npx prisma db push --schema=../database/prisma/schema.prisma --skip-generate > /dev/null 2>&1; then
        echo "  ✓ Database schema synced"
    else
        echo "  ✗ Schema sync failed"
        exit 1
    fi
fi

# 4. Run Seed Script
echo ""
echo "🌱 Step 4: Seeding demo data..."

if npm run seed > /dev/null 2>&1; then
    echo "  ✓ Demo data seeded successfully"
else
    echo "  ✗ Seed failed"
    npm run seed
    exit 1
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "📝 Demo credentials:"
echo "  Email:    arjun@demo"
echo "  Password: Demo1234!"
echo ""
echo "🚀 Next steps:"
echo "  1. Start dev server: npm run dev (from /backend)"
echo "  2. Start frontend:   npm run dev (from /frontend)"
echo "  3. Open browser:     http://localhost:5173"
echo ""
