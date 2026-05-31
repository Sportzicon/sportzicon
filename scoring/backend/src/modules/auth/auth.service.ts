import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma";
import { BadRequest, NotFound, Unauthorized } from "../../utils/errors";

const JWT_SECRET = process.env.JWT_SECRET || "scoring-secret-change-in-prod";
const ACCESS_TTL = "15m";
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signAccess(user: { id: string; role: string; email: string }) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId, type: "refresh" }, JWT_SECRET, { expiresIn: "30d" });
}

export async function signup(input: { email: string; password: string; full_name: string; role?: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw BadRequest("Email already in use");

  const hash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      password_hash: hash,
      full_name: input.full_name,
      role: (input.role as any) ?? "viewer"
    }
  });

  const access_token = signAccess(user);
  const refresh_raw = signRefresh(user.id);
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token: refresh_raw,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    access_token,
    refresh_token: refresh_raw
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw Unauthorized("Invalid credentials");

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw Unauthorized("Invalid credentials");

  const access_token = signAccess(user);
  const refresh_raw = signRefresh(user.id);
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token: refresh_raw,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });

  return {
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url },
    access_token,
    refresh_token: refresh_raw
  };
}

export async function refresh(token: string) {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.revoked || stored.expires_at < new Date()) throw Unauthorized("Invalid refresh token");

  const user = await prisma.user.findUnique({ where: { id: stored.user_id } });
  if (!user) throw Unauthorized("User not found");

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const access_token = signAccess(user);
  const refresh_raw = signRefresh(user.id);
  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token: refresh_raw,
      expires_at: new Date(Date.now() + REFRESH_TTL_MS)
    }
  });

  return { access_token, refresh_token: refresh_raw };
}

export async function logout(token: string) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
  return { ok: true };
}
