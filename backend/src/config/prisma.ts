import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["query", "error"] : ["error"]
});

// Warm the connection pool on server startup (not in test — tests bring their own DB)
if (env.NODE_ENV !== "test") {
  prisma.$connect().catch(() => undefined);
}
