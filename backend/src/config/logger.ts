import pino from "pino";
import { env, isProd } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  // In prod, structured JSON for Cloud Logging. In dev, pretty-print.
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" }
      },
  // Strip sensitive fields if they ever sneak in
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.password_hash",
      "*.refresh_token",
      "*.access_token",
      "*.token",
      "body.password",
      "body.currentPassword",
      "body.newPassword"
    ],
    remove: true
  }
});
