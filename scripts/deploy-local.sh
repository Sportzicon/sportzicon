#!/bin/bash
# Local Development Deployment Script
# Purpose: Start Sportivox locally with Docker Compose and emulators
# Usage: ./scripts/deploy-local.sh

set -e

echo "🚀 Starting Sportivox Local Development Environment..."

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker Desktop."
  exit 1
fi

if ! command -v docker compose &> /dev/null; then
  echo "❌ Docker Compose is not installed."
  exit 1
fi

# Change to project root
cd "$(dirname "$0")/.."

echo "📦 Building containers..."
docker compose down -v 2>/dev/null || true
docker compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check if services are running
if ! curl -s http://localhost:8081 > /dev/null; then
  echo "❌ Firestore emulator failed to start"
  docker compose logs firestore
  exit 1
fi

if ! curl -s http://localhost:8080 > /dev/null; then
  echo "⏳ Backend is starting... (this can take a moment)"
  sleep 5
fi

if ! curl -s http://localhost:5173 > /dev/null; then
  echo "⏳ Frontend is starting... (this can take a moment)"
  sleep 5
fi

echo ""
echo "✅ Sportivox is ready!"
echo ""
echo "📱 Frontend:   http://localhost:5173"
echo "🔌 API:        http://localhost:8080"
echo "🔥 Firestore:  http://localhost:8081 (emulator)"
echo "☁️  GCS:        http://localhost:4443 (emulator)"
echo ""
echo "📝 Default admin user:"
echo "   Email:    admin@sportivox.local"
echo "   Password: ChangeMe123!"
echo ""
echo "🛑 To stop: docker compose down"
echo "📋 To view logs: docker compose logs -f"
echo ""
