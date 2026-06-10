# Multi-stage Dockerfile for Sportivox Scoring API.
# Prisma client is generated automatically during the Docker build process.

# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini openssl

# ---- deps (full, for build & dev) ----
FROM base AS deps
ENV NODE_ENV=development
COPY scoring/backend/package.json scoring/backend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- build ----
FROM deps AS build
COPY scoring/backend/tsconfig.json ./
COPY scoring/backend/src ./src
# Copy scoring database schema for Prisma generation
COPY scoring/backend/prisma ./prisma
# Generate Prisma client
RUN ./node_modules/.bin/prisma generate
# Build and prune
RUN npm run build && npm prune --production

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini openssl && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY scoring/backend/package.json ./
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/server.js"]
