import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import scoringRoutes from "./modules/scoring/scoring.routes";

export function createApp() {
  const app = express();

  // Pure JSON API, no HTML ever served — default-deny CSP as a
  // defense-in-depth backstop, same reasoning as the main backend.
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  // No wildcard: explicit allowlist only, even though this API is header-auth
  // (not cookie-based) — "*" still lets any origin script read responses.
  const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map(o => o.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "scoring-api" }));
  app.get("/readyz", (_req, res) => res.json({ ok: true }));
  // Cloud Run reserves whatever path liveness_probe/startup_probe http_get.path
  // points to — external requests to that path never reach the container. Give
  // the probes their own paths so /healthz stays reachable for CI/monitoring.
  app.get("/internal/livez", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api", scoringRoutes);

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  app.use(errorHandler);

  return app;
}
