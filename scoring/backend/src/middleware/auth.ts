import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
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

type TokenResult =
  | { kind: "scoring"; payload: JwtPayload }
  | { kind: "main";    email: string; name: string; role: string };

function parseToken(token: string): TokenResult | null {
  // Scoring-native JWT
  try {
    const p = jwt.verify(token, JWT_SECRET!) as JwtPayload;
    return { kind: "scoring", payload: p };
  } catch {}

  // Main Sportivox JWT
  if (MAIN_JWT_SECRET) {
    try {
      const c = jwt.verify(token, MAIN_JWT_SECRET) as any;
      if (c.type !== "access") return null;
      return { kind: "main", email: c.email, name: c.name ?? c.email, role: c.role ?? "viewer" };
    } catch {}
  }

  return null;
}

function mapRole(r: string): "admin" | "organizer" | "scorer" | "viewer" {
  if (r === "admin")     return "admin";
  if (r === "organizer") return "organizer";
  if (r === "scorer")    return "scorer";
  return "viewer";
}

// Resolves a token to a valid scoring-DB JwtPayload.
// For main-app JWTs, finds or creates the scoring User so created_by FK always resolves.
async function resolvePayload(token: string): Promise<JwtPayload | null> {
  const result = parseToken(token);
  if (!result) return null;

  if (result.kind === "scoring") return result.payload;

  // Main JWT — ensure a scoring User exists for this email
  const { email, name, role } = result;
  const mapped = mapRole(role);

  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    if (user.role !== mapped) {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: mapped } });
    }
  } else {
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password_hash: "", // SSO users — no password needed
        full_name: name,
        role: mapped
      }
    });
  }

  return { sub: user.id, role: user.role, email: user.email };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Unauthorized("Missing token"));

  resolvePayload(header.slice(7))
    .then(payload => {
      if (!payload) return next(Unauthorized("Invalid or expired token"));
      req.user = payload;
      next();
    })
    .catch(next);
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  resolvePayload(header.slice(7))
    .then(payload => {
      if (payload) req.user = payload;
      next();
    })
    .catch(() => next()); // optional — ignore errors
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) return next(Unauthorized("Insufficient permissions"));
    next();
  };
}
