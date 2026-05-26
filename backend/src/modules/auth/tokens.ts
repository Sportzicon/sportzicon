import jwt, { type SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { db, Collections } from "../../config/firestore";
import { newId, now } from "../../utils/ids";
import type { Role, UserDoc } from "../../types/domain";

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

export function signAccessToken(user: Pick<UserDoc, "id" | "role" | "email" | "full_name">): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    email: user.email,
    name: user.full_name,
    type: "access"
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const jti = newId();
  const payload: RefreshTokenPayload = { sub: userId, jti, type: "refresh" };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as SignOptions["expiresIn"]
  });
  // Persist the jti so we can revoke (logout / password change) without giving up stateless access tokens.
  await db.collection(Collections.refreshTokens).doc(jti).set({
    jti,
    user_id: userId,
    issued_at: now(),
    revoked: false
  });
  return token;
}

export async function rotateRefreshToken(token: string): Promise<{ userId: string; newToken: string }> {
  const claims = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (claims.type !== "refresh") throw new Error("Invalid refresh token type");
  const ref = db.collection(Collections.refreshTokens).doc(claims.jti);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Refresh token not recognised");
  const data = snap.data() as { revoked: boolean };
  if (data.revoked) throw new Error("Refresh token revoked");
  // Single-use refresh — revoke old, issue new.
  await ref.update({ revoked: true, revoked_at: now() });
  const newToken = await issueRefreshToken(claims.sub);
  return { userId: claims.sub, newToken };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const claims = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    await db.collection(Collections.refreshTokens).doc(claims.jti).set(
      { revoked: true, revoked_at: now() },
      { merge: true }
    );
  } catch {
    // Invalid / expired tokens are effectively already revoked; swallow.
  }
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  const snaps = await db
    .collection(Collections.refreshTokens)
    .where("user_id", "==", userId)
    .where("revoked", "==", false)
    .get();
  const batch = db.batch();
  snaps.docs.forEach((d) => batch.update(d.ref, { revoked: true, revoked_at: now() }));
  await batch.commit();
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
