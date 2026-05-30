import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { ensureBuckets } from "./config/storage";
import { bootstrapAdminIfNeeded } from "./modules/auth/auth.service";
import { prisma } from "./config/prisma";

async function main() {
  const app = createApp();

  try {
    await ensureBuckets();
  } catch (err) {
    logger.warn({ err }, "bucket bootstrap skipped");
  }
  try {
    await bootstrapAdminIfNeeded();
  } catch (err) {
    logger.warn({ err }, "admin bootstrap skipped");
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Sportivox API listening");
  });

  // Graceful shutdown — Cloud Run sends SIGTERM at the end of a revision's lifecycle.
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(async (err) => {
      await prisma.$disconnect().catch(() => undefined);
      if (err) {
        logger.error({ err }, "server close error");
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "fatal startup error");
  process.exit(1);
});
