import { db, Collections } from "../../config/firestore";
import { env } from "../../config/env";
import { sendMail } from "../../config/mailer";
import { logger } from "../../config/logger";
import { newId, now } from "../../utils/ids";
import { BadRequest, Conflict, NotFound, Unauthorized } from "../../utils/errors";
import {
  comparePassword,
  hashPassword,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken
} from "./tokens";
import type { Role, UserDoc } from "../../types/domain";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m

async function findByEmail(email: string): Promise<UserDoc | null> {
  const snap = await db
    .collection(Collections.users)
    .where("email_lower", "==", email.trim().toLowerCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as UserDoc;
}

async function findByPhone(phone: string): Promise<UserDoc | null> {
  const snap = await db.collection(Collections.users).where("phone", "==", phone).limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].data() as UserDoc;
}

export async function signup(input: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: Role;
}) {
  const email = input.email.trim();
  const emailLower = email.toLowerCase();

  // SRS: prevent duplicate registrations using same email OR phone.
  if (await findByEmail(emailLower)) throw Conflict("An account with this email already exists");
  if (await findByPhone(input.phone)) throw Conflict("An account with this phone already exists");

  const id = newId();
  const password_hash = await hashPassword(input.password);

  const user: UserDoc = {
    id,
    email,
    email_lower: emailLower,
    email_verified: false,
    phone: input.phone,
    phone_verified: false,
    password_hash,
    full_name: input.full_name,
    full_name_lower: input.full_name.toLowerCase(),
    role: input.role,
    status: "pending", // becomes "active" after email verification
    verification: { badges: [], status: "unverified" },
    follower_count: 0,
    following_count: 0,
    created_at: now(),
    updated_at: now(),
    last_active_at: now()
  };

  await db.collection(Collections.users).doc(id).set(user);

  await issueAndSendVerificationEmail(user.id, user.email, user.full_name);

  return { id, email, role: input.role };
}

async function issueAndSendVerificationEmail(userId: string, email: string, name: string) {
  const token = newId() + newId().replace(/-/g, "");
  const expires_at = now() + VERIFY_TTL_MS;

  await db.collection(Collections.emailVerifications).doc(token).set({
    token,
    user_id: userId,
    email,
    expires_at,
    used: false,
    created_at: now()
  });

  const link = `${env.WEB_APP_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Verify your Sportivox account",
    html: `<p>Hi ${escapeHtml(name)},</p>
           <p>Welcome to Sportivox. Click the link below to verify your email and activate your account. This link expires in 24 hours.</p>
           <p><a href="${link}">Verify my email</a></p>
           <p>If you didn't sign up, you can safely ignore this email.</p>`
  });
  logger.info({ userId }, "verification email queued");
}

export async function verifyEmail(token: string) {
  const ref = db.collection(Collections.emailVerifications).doc(token);
  const snap = await ref.get();
  if (!snap.exists) throw BadRequest("Invalid verification token");
  const data = snap.data() as { user_id: string; expires_at: number; used: boolean };
  if (data.used) throw BadRequest("This link has already been used");
  if (data.expires_at < now()) throw BadRequest("This link has expired");

  const userRef = db.collection(Collections.users).doc(data.user_id);
  await db.runTransaction(async (tx) => {
    const u = await tx.get(userRef);
    if (!u.exists) throw NotFound("User not found");
    tx.update(userRef, { email_verified: true, status: "active", updated_at: now() });
    tx.update(ref, { used: true, used_at: now() });
  });
  return { ok: true };
}

export async function resendVerification(email: string) {
  const user = await findByEmail(email);
  // Always 200 — don't leak which emails exist.
  if (!user) return { ok: true };
  if (user.email_verified) return { ok: true };
  await issueAndSendVerificationEmail(user.id, user.email, user.full_name);
  return { ok: true };
}

export async function login(email: string, password: string) {
  const user = await findByEmail(email);
  if (!user) throw Unauthorized("Invalid credentials");
  const ok = await comparePassword(password, user.password_hash);
  if (!ok) throw Unauthorized("Invalid credentials");
  if (user.status === "suspended") throw Unauthorized("Account is suspended");
  if (!user.email_verified) throw Unauthorized("Email not verified — please check your inbox");

  await db.collection(Collections.users).doc(user.id).update({ last_active_at: now() });

  const access_token = signAccessToken(user);
  const refresh_token = await issueRefreshToken(user.id);

  return {
    access_token,
    refresh_token,
    user: publicUser(user)
  };
}

export async function refresh(token: string) {
  let result;
  try {
    result = await rotateRefreshToken(token);
  } catch (err: any) {
    throw Unauthorized(err?.message ?? "Invalid refresh token");
  }
  const userSnap = await db.collection(Collections.users).doc(result.userId).get();
  if (!userSnap.exists) throw Unauthorized("User no longer exists");
  const user = userSnap.data() as UserDoc;
  if (user.status === "suspended") throw Unauthorized("Account is suspended");
  return {
    access_token: signAccessToken(user),
    refresh_token: result.newToken,
    user: publicUser(user)
  };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return { ok: true };
}

export async function forgotPassword(email: string) {
  const user = await findByEmail(email);
  if (!user) return { ok: true }; // do not leak existence

  const token = newId() + newId().replace(/-/g, "");
  await db.collection(Collections.passwordResets).doc(token).set({
    token,
    user_id: user.id,
    expires_at: now() + RESET_TTL_MS,
    used: false,
    created_at: now()
  });
  const link = `${env.WEB_APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your Sportivox password",
    html: `<p>We received a request to reset your password. This link expires in 30 minutes:</p>
           <p><a href="${link}">Reset password</a></p>
           <p>If you didn't request this, you can ignore this email.</p>`
  });
  return { ok: true };
}

export async function resetPassword(token: string, password: string) {
  const ref = db.collection(Collections.passwordResets).doc(token);
  const snap = await ref.get();
  if (!snap.exists) throw BadRequest("Invalid reset token");
  const data = snap.data() as { user_id: string; expires_at: number; used: boolean };
  if (data.used) throw BadRequest("This link has already been used");
  if (data.expires_at < now()) throw BadRequest("This link has expired");

  const hash = await hashPassword(password);
  await db.runTransaction(async (tx) => {
    tx.update(db.collection(Collections.users).doc(data.user_id), {
      password_hash: hash,
      updated_at: now()
    });
    tx.update(ref, { used: true, used_at: now() });
  });
  // Force re-login everywhere after a password change.
  await revokeAllRefreshTokensForUser(data.user_id);
  return { ok: true };
}

export async function changePassword(userId: string, current: string, next_: string) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  const user = snap.data() as UserDoc;
  const ok = await comparePassword(current, user.password_hash);
  if (!ok) throw Unauthorized("Current password is incorrect");
  const hash = await hashPassword(next_);
  await ref.update({ password_hash: hash, updated_at: now() });
  await revokeAllRefreshTokensForUser(userId);
  return { ok: true };
}

export function publicUser(u: UserDoc) {
  const { password_hash, email_lower, full_name_lower, ...safe } = u;
  return safe;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}

// Bootstrap helper: create an admin account if no admin exists yet.
export async function bootstrapAdminIfNeeded() {
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) return;
  const adminSnap = await db.collection(Collections.users).where("role", "==", "admin").limit(1).get();
  if (!adminSnap.empty) return;

  const id = newId();
  const password_hash = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD);
  const adminUser: UserDoc = {
    id,
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    email_lower: env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
    email_verified: true,
    phone: "+0000000000",
    phone_verified: false,
    password_hash,
    full_name: "Sportivox Admin",
    full_name_lower: "sportivox admin",
    role: "admin",
    status: "active",
    verification: { badges: ["verified_admin"], status: "approved" },
    follower_count: 0,
    following_count: 0,
    created_at: now(),
    updated_at: now(),
    last_active_at: now()
  };
  await db.collection(Collections.users).doc(id).set(adminUser);
  logger.warn({ email: adminUser.email }, "Bootstrapped admin account. CHANGE THE PASSWORD IMMEDIATELY.");
}
