import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Unauthorized } from "../utils/errors";

const JWT_SECRET      = process.env.JWT_SECRET || "";
const MAIN_JWT_SECRET = process.env.MAIN_JWT_SECRET || "";

if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required");

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Accepts either a scoring-issued JWT (from /auth/sso) or a main Sportivox
// JWT directly — both carry `sub` = the main User.id, so no DB lookup is
// needed to resolve identity (scoring tables FK straight to main User.id).
function resolvePayload(token: string): JwtPayload | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as any;
    return { sub: p.sub, role: p.role, email: p.email };
  } catch {}

  if (MAIN_JWT_SECRET) {
    try {
      const c = jwt.verify(token, MAIN_JWT_SECRET) as any;
      if (c.type !== "access") return null;
      return { sub: c.sub, role: c.role ?? "athlete", email: c.email };
    } catch {}
  }

  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Unauthorized("Missing token"));

  const payload = resolvePayload(header.slice(7));
  if (!payload) return next(Unauthorized("Invalid or expired token"));
  req.user = payload;
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const payload = resolvePayload(header.slice(7));
  if (payload) req.user = payload;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role) && req.user.role !== "admin") return next(Unauthorized("Insufficient permissions"));
    next();
  };
}
