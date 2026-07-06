import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { env } from "../config/env";
import { getRedisClient } from "../config/redis";

// Redis-backed store so limits hold across multiple Cloud Run instances,
// not just per-process. Falls back to express-rate-limit's default
// in-memory MemoryStore when REDIS_URL is unset (today's exact behavior,
// same seam pattern as config/redis.ts). On a Redis error at runtime,
// passOnStoreError (set on every limiter below) lets the request through
// rather than 500ing — fail open, same philosophy as the cache helpers.
function redisStore(prefix: string) {
  if (!env.REDIS_URL) return undefined;
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      const client = await getRedisClient();
      if (!client) throw new Error("redis unavailable");
      return client.call(...args);
    }
  });
}

// General per-IP rate limit for the whole API.
export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: redisStore("rl:api:"),
  passOnStoreError: true,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests, slow down." } }
});

// Stricter limiter for auth endpoints — protects against brute-force.
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: redisStore("rl:auth:"),
  passOnStoreError: true,
  message: { error: { code: "RATE_LIMITED", message: "Too many auth attempts. Try again later." } }
});

// Stricter limiter for the scorecard link preview endpoint — it makes outbound fetches.
export const linkPreviewLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  store: redisStore("rl:link:"),
  passOnStoreError: true,
  message: { error: { code: "RATE_LIMITED", message: "Too many preview requests. Try again later." } }
});
