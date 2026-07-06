import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";
const CORS_ORIGINS = (process.env.CORS_ORIGIN || "").split(",").map(o => o.trim()).filter(Boolean);

let io: SocketServer | null = null;

function verifyToken(token: string): string | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    return p.sub;
  } catch {}
  if (MAIN_JWT_SECRET) {
    try {
      const c = jwt.verify(token, MAIN_JWT_SECRET) as any;
      if (c.type === "access") return c.sub;
    } catch {}
  }
  return null;
}

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  io = new SocketServer(httpServer, {
    cors: { origin: CORS_ORIGINS, credentials: true },
    transports: ["websocket", "polling"],
  });

  // ponytail: single-instance in-memory adapter today (service is pinned to
  // min/max-instances=1). Swap to multi-instance only when concurrent
  // connections approach ~15-20K or deploy-during-live-match becomes painful
  // (see docs/SCALING_PLAN.md Future-Scale Hooks table).
  if (process.env.REDIS_URL) {
    const { createAdapter } = await import("@socket.io/redis-adapter");
    const { default: Redis } = await import("ioredis");
    const pub = new Redis(process.env.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use((socket: Socket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.replace("Bearer ", "") ?? "");
    const userId = token ? verifyToken(token) : null;
    if (!userId) return next(new Error("Invalid token"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", (socket: Socket) => {
    // ponytail: no rooms/events yet — live-match broadcast is Phase 2 work.
    socket.on("disconnect", () => {});
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}
