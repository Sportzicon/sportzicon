import jwt, { type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import type { Role } from "../../types/domain";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  email: string;
  name: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: "refresh";
}

export function signAccessToken(user: { id: string; role: Role; email: string; full_name: string }): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role as Role,
    email: user.email,
    name: user.full_name,
    type: "access"
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const payload: RefreshTokenPayload = { sub: userId, jti, type: "refresh" };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"]
  });
  const expiresAt = new Date(Date.now() + parseTtlMs(env.JWT_REFRESH_TTL));
  await prisma.refreshToken.create({
    data: { token, user_id: userId, expires_at: expiresAt }
  });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ userId: string; newToken: string }> {
  const claims = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (claims.type !== "refresh") throw new Error("Invalid refresh token type");

  const record = await prisma.refreshToken.findUnique({ where: { token } });
  if (!record) throw new Error("Refresh token not recognised");
  if (record.revoked) throw new Error("Refresh token revoked");

  await prisma.refreshToken.update({ where: { token }, data: { revoked: true } });
  const newToken = await issueRefreshToken(claims.sub);
  return { userId: claims.sub, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    jwt.verify(token, env.JWT_REFRESH_SECRET);
    await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
  } catch {
    // Invalid or expired tokens are effectively revoked already.
  }
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true }
  });
}

export function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function parseTtlMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 3600 * 1000;
  const n = parseInt(match[1]);
  const unit: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * (unit[match[2]] ?? 86_400_000);
}
