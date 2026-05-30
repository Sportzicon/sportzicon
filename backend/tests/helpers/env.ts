// Loaded by jest before each test file. Set minimal env so config/env.ts validates.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "warn";
process.env.JWT_ACCESS_SECRET = "test-access-secret-please-change";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-please-change";
process.env.JWT_ACCESS_TTL = "15m";
process.env.JWT_REFRESH_TTL = "1d";
process.env.BCRYPT_ROUNDS = "10"; // 10 keeps tests fast while staying above the floor
process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://sportivox:localdev@localhost:5432/sportivox_test";
process.env.GCP_PROJECT_ID = "sportivox-test";
process.env.GCS_BUCKET_MEDIA = "sportivox-media-test";
process.env.GCS_BUCKET_DOCS = "sportivox-docs-test";
process.env.STORAGE_EMULATOR_HOST = "http://localhost:4443";
process.env.CORS_ORIGINS = "http://localhost:5173";
process.env.RATE_LIMIT_MAX = "10000";
process.env.AUTH_RATE_LIMIT_MAX = "10000";
process.env.WEB_APP_URL = "http://localhost:5173";
process.env.PUBLIC_API_URL = "http://localhost:8080";
