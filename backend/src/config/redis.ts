import { env } from "./env";
import { logger } from "./logger";

// Lazily imported so the app starts fine without ioredis installed in dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any | null = null;
let redisAvailable = false;

// Exposed for callers that need the raw client (e.g. rate limiter's atomic
// INCR) rather than the string get/set/del helpers below.
export async function getRedisClient() {
  return getClient();
}

async function getClient() {
  if (client !== null) return client;
  if (!env.REDIS_URL) return null;

  try {
    const { default: Redis } = await import("ioredis");
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
    });
    client.on("error", (err: Error) => {
      if (redisAvailable) logger.warn({ err }, "Redis connection error — cache disabled");
      redisAvailable = false;
      client = null; // force reconnect attempt on next call
    });
    await client.connect();
    redisAvailable = true;
    logger.info("Redis connected");
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — running without cache");
    client = null;
  }
  return client;
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const c = await getClient();
    if (!c) return null;
    return await c.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const c = await getClient();
    if (!c) return;
    await c.set(key, value, "EX", ttlSeconds);
  } catch {
    // no-op — cache is best-effort
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  try {
    const c = await getClient();
    if (!c) return;
    await c.del(...keys);
  } catch {
    // no-op
  }
}
