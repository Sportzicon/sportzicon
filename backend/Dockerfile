# Multi-stage Dockerfile for Sportivox API.
# Prisma client is generated automatically during the Docker build process.

# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini openssl

# ---- deps (full, for build & dev) ----
FROM base AS deps
ENV NODE_ENV=development
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- dev (used by docker-compose) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/docker-start.sh ./
RUN chmod +x ./docker-start.sh
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
CMD ["./docker-start.sh"]

# ---- build ----
FROM deps AS build
COPY backend/tsconfig.json ./
COPY backend/src ./src
# Copy database schema for Prisma generation
COPY database/prisma ./prisma
# Generate Prisma client (copy instead of symlink for Windows CI/CD compatibility)
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
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER app
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
# Run pending migrations then start the server. If migrate deploy fails the
# container exits non-zero, Cloud Run keeps traffic on the previous revision.
CMD ["sh","-c","./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
