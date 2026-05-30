#!/bin/sh
set -e

# Set up Prisma schema (copy instead of symlink for Windows compatibility)
if [ ! -f "prisma/schema.prisma" ]; then
  echo "Setting up Prisma schema..."
  mkdir -p prisma
  cp ../database/prisma/schema.prisma prisma/
fi

# Generate Prisma client in the current directory (backend)
echo "Generating Prisma client..."
./node_modules/.bin/prisma generate

# Verify generation succeeded
if [ ! -f "node_modules/.prisma/client/default.js" ]; then
  echo "ERROR: Prisma client generation failed!"
  exit 1
fi

echo "Prisma client ready ✓"

# Start dev server
echo "Starting development server..."
exec npx tsx watch src/server.ts
