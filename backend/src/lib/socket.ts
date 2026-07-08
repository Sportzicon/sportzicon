import { Server as HttpServer } from "http";
import { Server as SocketServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { corsOrigins } from "../config/env";
import { logger } from "../config/logger";

interface AuthClaims {
  sub: string;
  type: string;
}

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    transports: ["websocket", "polling"],
  });

  io.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        (socket.handshake.headers.authorization?.replace("Bearer ", "") ?? "");
      if (!token) return next(new Error("Missing token"));
      const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthClaims;
      if (claims.type !== "access") return next(new Error("Invalid token type"));
      socket.data.userId = claims.sub;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = socket.data.userId as string;
    logger.debug({ userId, socketId: socket.id }, "socket connected");

    // Client sends the conversation IDs it wants to subscribe to
    socket.on("join", (conversationIds: string[]) => {
      if (!Array.isArray(conversationIds)) return;
      for (const id of conversationIds.slice(0, 50)) {
        if (typeof id === "string") socket.join(`conv:${id}`);
      }
    });

    socket.on("leave", (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on("disconnect", () => {
      logger.debug({ userId, socketId: socket.id }, "socket disconnected");
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Socket.io not initialised");
  return io;
}

/** Emit a new message to all sockets in a conversation room */
export function emitNewMessage(
  conversationId: string,
  payload: {
    id: string;
    conversation_id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
  }
) {
  if (!io) return;
  io.to(`conv:${conversationId}`).emit("new_message", payload);
}

// Content (post/blog/reel) and comment engagement is broadcast to every
// connected client rather than a per-content room — like/comment counts are
// small, already-public-once-visible payloads, and this app's scale doesn't
// need per-card room join/leave churn as users scroll a mixed feed. Clients
// no-op on events for content not currently in their cache.

/** Broadcast a content like/unlike count change. */
export function emitContentLikeChanged(payload: { contentId: string; like_count: number; liked_by: string }) {
  if (!io) return;
  io.emit("content_like_changed", payload);
}

/** Broadcast a newly-added comment. */
export function emitCommentAdded(payload: { contentId: string; comment: unknown; comment_count: number }) {
  if (!io) return;
  io.emit("comment_added", payload);
}

/** Broadcast a comment like/unlike count change. */
export function emitCommentLikeChanged(payload: { contentId: string; commentId: string; like_count: number }) {
  if (!io) return;
  io.emit("comment_like_changed", payload);
}
