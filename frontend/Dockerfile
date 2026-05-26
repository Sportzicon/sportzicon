# Multi-stage Dockerfile for the Sportivox web app.
# - dev: vite dev server
# - prod: static build served by nginx via Cloud Run

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
COPY . .
RUN npm run build

# Tiny final image — nginx serves the built static assets.
FROM nginx:1.27-alpine AS runtime
RUN apk add --no-cache tini
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
ENTRYPOINT ["/sbin/tini","--"]
CMD ["nginx","-g","daemon off;"]
