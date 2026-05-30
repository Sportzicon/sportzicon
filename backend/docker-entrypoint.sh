#!/bin/sh
# Wait for Prisma schema to be available, generate client, then start dev server
set -e

echo "Starting Sportivox API..."

# Give docker-compose time to mount volumes
sleep 2

# Try to generate Prisma client if schema is mounted
if [ -f /database/prisma/schema.prisma ]; then
  echo "Generating Prisma client..."
  npx prisma generate --schema=/database/prisma/schema.prisma || echo "Prisma generation warning - may not be critical"
else
  echo "Warning: Prisma schema not found at /database/prisma/schema.prisma"
fi

# Start the development server
echo "Starting development server..."
exec npx tsx watch src/server.ts
