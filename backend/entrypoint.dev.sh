#!/bin/sh
# Development entrypoint: ensure Prisma is generated, then start dev server

# Try to generate Prisma client if schema exists at parent path
if [ -f "../database/prisma/schema.prisma" ]; then
  echo "Generating Prisma client from schema..."
  npx prisma generate --schema=../database/prisma/schema.prisma 2>/dev/null || true
fi

# Start dev server with hot reload
echo "Starting development server..."
exec npx tsx watch src/server.ts
