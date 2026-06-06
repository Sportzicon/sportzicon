import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./modules/auth/auth.routes";
import scoringRoutes from "./modules/scoring/scoring.routes";

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  const rawOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = rawOrigin === "*"
    ? "*"
    : rawOrigin.split(",").map(o => o.trim());
  app.use(cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"]
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "scoring-api" }));

  app.use("/api/auth", authRoutes);
  app.use("/api", scoringRoutes);

  app.use((_req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } }));
  app.use(errorHandler);

  return app;
}
