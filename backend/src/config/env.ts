import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  PUBLIC_API_URL: z.string().url().optional(),
  WEB_APP_URL: z.string().url().default("http://localhost:5173"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(10),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  GCP_PROJECT_ID: z.string().default("sportzicon-dev"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  STORAGE_EMULATOR_HOST: z.string().optional(),

  GCS_BUCKET_MEDIA: z.string().default("sportzicon-media-dev"),
  GCS_BUCKET_DOCS: z.string().default("sportzicon-docs-dev"),
  GCS_SIGNED_URL_TTL_MIN: z.coerce.number().int().positive().default(15),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default("no-reply@sportzicon.com"),
  EMAIL_FROM_NAME: z.string().default("Sportzicon"),

  REDIS_URL: z.string().url().optional(),

  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional()
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast on misconfiguration — never run with partial config.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
export const usingGcsEmulator = Boolean(env.STORAGE_EMULATOR_HOST);
