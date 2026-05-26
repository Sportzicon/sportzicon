import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Forbidden, Unauthorized } from "../utils/errors";
import type { Role } from "../types/domain";

export interface AuthClaims {
  sub: string;        // user id
  role: Role;
  email: string;
  name: string;
  type: "access";
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthClaims;
  }
}

function readToken(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth && auth.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return undefined;
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next(Unauthorized("Missing access token"));
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthClaims;
    if (claims.type !== "access") return next(Unauthorized("Invalid token type"));
    req.user = claims;
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") return next(Unauthorized("Access token expired"));
    return next(Unauthorized("Invalid access token"));
  }
};

// Optional auth — populates req.user if a valid token is present but doesn't require it.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const claims = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthClaims;
    if (claims.type === "access") req.user = claims;
  } catch {
    // ignore — treated as anonymous
  }
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) return next(Forbidden(`Requires role: ${roles.join(" | ")}`));
    next();
  };
