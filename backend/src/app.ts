import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./config/logger";
import { corsOrigins, env } from "./config/env";
import { requestId } from "./middleware/requestId";
import { apiLimiter } from "./middleware/rateLimit";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import followRoutes from "./modules/follow/follow.routes";
import organizationsRoutes from "./modules/organizations/organizations.routes";
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
import scoringRoutes from "./modules/scoring/scoring.routes";

export function createApp(): Express {
  const app = express();

  // Behind a load balancer in Cloud Run — trust the first proxy for X-Forwarded-* headers.
  app.set("trust proxy", 1);

  // Security headers (CSP intentionally permissive for cross-origin API + signed-URL uploads).
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );

  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin/no-origin (curl, health probes) plus the configured allowlist.
        if (!origin) return cb(null, true);
        if (corsOrigins.includes(origin) || corsOrigins.includes("*")) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: false,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"]
    })
  );

  // Raw body parser for file uploads (MUST come before other parsers)
  app.use("/api/v1/media/upload", express.raw({ type: "*/*", limit: "100mb" }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/follow", followRoutes);
  app.use("/api/v1/organizations", organizationsRoutes);
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
  app.use("/api/v1/scoring", scoringRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
