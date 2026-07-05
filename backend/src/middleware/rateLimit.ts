import rateLimit from "express-rate-limit";
import { env } from "../config/env";

// General per-IP rate limit for the whole API.
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests, slow down." } }
});

// Stricter limiter for auth endpoints — protects against brute-force.
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many auth attempts. Try again later." } }
});

// Stricter limiter for the scorecard link preview endpoint — it makes outbound fetches.
export const linkPreviewLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many preview requests. Try again later." } }
});
