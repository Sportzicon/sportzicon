import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Unauthorized } from "../utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "scoring-secret-change-in-prod";

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

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw Unauthorized("Missing token");

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw Unauthorized("Invalid or expired token");
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET) as JwtPayload;
    } catch {}
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw Unauthorized();
    if (!roles.includes(req.user.role)) throw Unauthorized("Insufficient permissions");
    next();
  };
}
