import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { corsOrigins, env } from "./config/env";
import { bootstrapEventHandlers } from "./events/bootstrap";
import { requestId } from "./middleware/requestId";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import followRoutes from "./modules/follow/follow.routes";
import organizationsRoutes from "./modules/organizations/organizations.routes";
import tournamentsRoutes from "./modules/tournaments/tournaments.routes";
import opportunitiesRoutes from "./modules/opportunities/opportunities.routes";
import applicationsRoutes from "./modules/applications/applications.routes";
import searchRoutes from "./modules/search/search.routes";
import messagingRoutes from "./modules/messaging/messaging.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import postsRoutes from "./modules/posts/posts.routes";
import commentsRoutes from "./modules/posts/comments.routes";
import reelsRoutes from "./modules/reels/reels.routes";
import blogsRoutes from "./modules/blogs/blogs.routes";
import aiRoutes from "./modules/ai/ai.routes";
import mediaRoutes from "./modules/media/media.routes";
import verificationRoutes from "./modules/verification/verification.routes";
import adminRoutes from "./modules/admin/admin.routes";
import reportsRoutes from "./modules/admin/reports.routes";
import emailLogsRoutes from "./modules/email-logs/email-logs.routes";
import statsRoutes from "./modules/stats/stats.routes";

export function createApp(): Express {
  bootstrapEventHandlers();
  const app = express();

  // Behind a load balancer in Cloud Run — trust the first proxy for X-Forwarded-* headers.
  app.set("trust proxy", 1);

  // Security headers. This is a pure JSON API — it never serves HTML, so the
  // CSP doesn't need frontend-origin/GCS-host allowlisting (nothing here
  // loads a script/style/image into a page). Locked to default-deny as a
  // defense-in-depth backstop against any accidental HTML reflection
  // (framework error pages, misconfigured routes).
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/no-origin (curl, health probes) plus the configured allowlist.
        // No wildcard bypass: cookies (credentials: true) can never be paired with "*".
        if (!origin) return cb(null, true);
        if (corsOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"]
    })
  );

  // gzip/deflate response bodies — skip for the raw upload route, no point
  // compressing already-binary/large uploads and it'd force full buffering.
  app.use(compression({ filter: (req, res) => !req.path.startsWith("/api/v1/media/upload") && compression.filter(req, res) }));

  // Raw body parser for file uploads (MUST come before other parsers)
  app.use("/api/v1/media/upload", express.raw({ type: "*/*", limit: "100mb" }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/healthz" || req.url === "/readyz" }
    })
  );
  app.use(apiLimiter);

  // Liveness / readiness probes for Cloud Run + load balancers.
  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "sportzicon-api", env: env.NODE_ENV }));
  app.get("/readyz", (_req, res) => res.json({ ok: true }));
  // Cloud Run reserves whatever path liveness_probe.http_get.path points to —
  // external requests to that path never reach the container. Give the probe
  // its own path so /healthz stays reachable for CI/monitoring.
  app.get("/internal/livez", (_req, res) => res.json({ ok: true }));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/follow", followRoutes);
  app.use("/api/v1/organizations", organizationsRoutes);
  app.use("/api/v1", tournamentsRoutes); // nested under /organizations/:orgId/org-tournaments and /org-tournaments/...
  app.use("/api/v1/opportunities", opportunitiesRoutes);
  app.use("/api/v1", applicationsRoutes); // nested under /opportunities/:id/apply and /applications/...
  app.use("/api/v1/search", searchRoutes);
  app.use("/api/v1", messagingRoutes); // /conversations, /messages
  app.use("/api/v1/notifications", notificationsRoutes);
  app.use("/api/v1/posts", postsRoutes);
  app.use("/api/v1/comments", commentsRoutes);
  app.use("/api/v1/reels", reelsRoutes);
  app.use("/api/v1/blogs", blogsRoutes);
  app.use("/api/v1/ai", aiRoutes);
  app.use("/api/v1/media", mediaRoutes);
  app.use("/api/v1/verifications", verificationRoutes);
  app.use("/api/v1/reports", reportsRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1", emailLogsRoutes);
  app.use("/api/v1/stats", statsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
