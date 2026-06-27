import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { ensureBuckets } from "./config/storage";
import { bootstrapAdminIfNeeded } from "./modules/auth/auth.service";
import { checkAndCloseExpiredOpportunities } from "./modules/opportunities/opportunities.service";
import { deleteOldNotifications } from "./modules/notifications/notifications.service";
import { prisma } from "./config/prisma";
import { initSocket } from "./lib/socket";

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

  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Sportzicon API listening");
  });

  // Auto-close opportunities whose deadline has passed — runs every 5 minutes.
  void checkAndCloseExpiredOpportunities();
  const autoCloseTimer = setInterval(() => void checkAndCloseExpiredOpportunities(), 5 * 60 * 1000);
  autoCloseTimer.unref();

  // Delete notifications older than 90 days — runs once daily.
  void deleteOldNotifications();
  const notifCleanupTimer = setInterval(() => void deleteOldNotifications(), 24 * 60 * 60 * 1000);
  notifCleanupTimer.unref();

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
