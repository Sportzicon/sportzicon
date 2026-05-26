# Multi-stage Dockerfile for Sportivox API.
# - dev: tsx watch with source mounted
# - prod: compiled JS, distroless-style minimal image

# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini

# ---- deps (full, for build & dev) ----
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ---- dev (used by docker-compose) ----
FROM deps AS dev
ENV NODE_ENV=development
COPY tsconfig.json ./
COPY src ./src
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
CMD ["npx","tsx","watch","src/server.ts"]

# ---- build ----
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --production

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/server.js"]
