# Multi-stage Dockerfile for the Sportivox web app.
# - dev: vite dev server
# - runtime: static build served by nginx via Cloud Run

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm","run","dev"]

FROM deps AS build
ARG VITE_API_BASE_URL=http://localhost:8080
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# VITE_SCORING_API_URL is intentionally NOT baked in — nginx proxies /scoring-api/ at runtime.
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
# gettext provides envsubst to inject SCORING_API_URL into nginx config at startup.
RUN apk add --no-cache tini gettext
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/nginx.conf.template
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
# envsubst replaces ${SCORING_API_URL} only; all other nginx $variables are left untouched.
# Default fallback returns 502 if scoring backend is not deployed in this environment.
CMD ["sh", "-c", \
  "SCORING_API_URL=${SCORING_API_URL:-http://127.0.0.1:1} \
   envsubst '${SCORING_API_URL}' \
     < /etc/nginx/templates/nginx.conf.template \
     > /etc/nginx/conf.d/default.conf \
  && nginx -g 'daemon off;'"]
