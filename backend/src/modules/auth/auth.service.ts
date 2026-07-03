import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { sendMail } from "../../config/mailer";
import { logger } from "../../config/logger";
import { BadRequest, Conflict, Forbidden, NotFound, Unauthorized, TooManyRequests } from "../../utils/errors";
import { omitSensitive } from "../../utils/user";
import { validateAthleteSportProfile } from "../users/sportProfile";
import { createOrganization } from "../organizations/organizations.service";
import {
  comparePassword,
  generateToken,
  hashPassword,
  issueRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken
} from "./tokens";
import type { Role } from "../../types/domain";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const RESET_TTL_MS = 1000 * 60 * 30; // 30m

export async function signup(input: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: Role;
  country?: string;
  state?: string;
  city?: string;
  dob?: string;
  gender?: string;
  primary_sport?: string;
  position?: string;
  experience_level?: string;
  looking_for_club?: boolean;
}) {
  const email = input.email.trim();
  const emailLower = email.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email_lower: emailLower }, { phone: input.phone }] },
    select: { email_lower: true, phone: true }
  });
  if (existing?.email_lower === emailLower) throw Conflict("An account with this email already exists");
  if (existing?.phone === input.phone) throw Conflict("An account with this phone already exists");

  const password_hash = await hashPassword(input.password);

  const athleteData =
    input.role === "athlete" && input.primary_sport
      ? {
          primary_sport: input.primary_sport,
          position: input.position ?? "",
          experience_level: input.experience_level ?? "amateur",
          looking_for_club: input.looking_for_club ?? false,
          availability: "available",
          stats: {}
        }
      : undefined;

  const user = await prisma.user.create({
    data: {
      email,
      email_lower: emailLower,
      email_verified: false,
      phone: input.phone,
      password_hash,
      full_name: input.full_name,
      full_name_lower: input.full_name.toLowerCase(),
      role: input.role,
      status: "pending",
      country: input.country,
      state: input.state,
      city: input.city,
      dob: input.dob,
      gender: input.gender,
      athlete_data: athleteData as object ?? undefined
    }
  });

  await issueAndSendVerificationEmail(user.id, user.email, user.full_name);

  return { id: user.id, email: user.email, role: input.role };
}

async function issueAndSendVerificationEmail(userId: string, email: string, name: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS);

  await prisma.emailVerification.create({
    data: { user_id: userId, token, expires_at: expiresAt }
  });

  const link = `${env.WEB_APP_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Verify your Sportzicon account",
    html: `<p>Hi ${escapeHtml(name)},</p>
           <p>Welcome to Sportzicon! Click the link below to verify your email and activate your account. This link expires in <strong>24 hours</strong>.</p>
           <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#FA4D14;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">Verify my email</a></p>
           <p>If the button above doesn't work, copy and paste this link into your browser:</p>
           <p style="word-break:break-all;color:#555;">${link}</p>
           <p>If you didn't sign up for Sportzicon, you can safely ignore this email.</p>
           <p style="color:#888;font-size:12px;">Didn't receive this email? Check your <strong>spam or junk folder</strong>.</p>`,
    text: `Hi ${name},\n\nWelcome to Sportzicon! Click the link below to verify your email and activate your account. This link expires in 24 hours.\n\nVerify my email:\n${link}\n\nIf you didn't sign up for Sportzicon, you can safely ignore this email.\n\nDidn't receive this email? Check your spam or junk folder.`,
    user_id: userId,
    email_type: "email_verification"
  });
  logger.info({ userId }, "verification email queued");
}

export async function verifyEmail(token: string) {
  const record = await prisma.emailVerification.findUnique({ where: { token } });
  if (!record) throw BadRequest("Invalid verification token");
  if (record.expires_at < new Date()) throw BadRequest("This link has expired");

  const user = await prisma.user.findUnique({ where: { id: record.user_id } });
  if (!user) throw NotFound("User not found");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user_id },
      data: { email_verified: true, status: "active" }
    }),
    prisma.emailVerification.delete({ where: { token } })
  ]);

  return { ok: true };
}

export async function resendVerification(email: string) {
  const user = await prisma.user.findUnique({
    where: { email_lower: email.trim().toLowerCase() },
    select: { id: true, email: true, full_name: true, email_verified: true }
  });
  if (!user || user.email_verified) return { ok: true };

  // Rate limit: max 3 verification emails per email per hour
  const hourStart = new Date(Date.now() - 60 * 60 * 1000);
  const recentVerifications = await prisma.emailVerification.count({
    where: { user_id: user.id, created_at: { gte: hourStart } }
  });
  if (recentVerifications >= 3) return { ok: true };

  await issueAndSendVerificationEmail(user.id, user.email, user.full_name);
  return { ok: true };
}

export async function login(email: string, password: string) {
  const emailLower = email.trim().toLowerCase();

  const windowStart = new Date(Date.now() - 15 * 60 * 1000);

  // Fetch brute-force count and user in parallel
  const [recentAttempts, user] = await Promise.all([
    prisma.loginAttempt.count({ where: { email: emailLower, attempted_at: { gte: windowStart } } }),
    prisma.user.findUnique({ where: { email_lower: emailLower } })
  ]);

  if (recentAttempts >= 5) {
    throw TooManyRequests("Too many login attempts. Please try again in a few minutes.");
  }

  if (!user) {
    await prisma.loginAttempt.create({ data: { email: emailLower } });
    throw Unauthorized("Invalid credentials");
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    await prisma.loginAttempt.create({ data: { email: emailLower } });
    throw Unauthorized("Invalid credentials");
  }
  if (user.status === "suspended") throw Unauthorized("Account is suspended");
  if (!user.email_verified) throw Unauthorized("Email not verified — please check your inbox");

  if (user.verification_status === "pending") {
    throw Forbidden("Your verification is pending admin review. We'll notify you once it's approved.");
  }
  if (user.role === "club" || user.role === "organizer") {
    const pendingOrg = await prisma.organization.findFirst({
      where: { owner_user_id: user.id, verification_status: "pending" },
      select: { id: true }
    });
    if (pendingOrg) {
      throw Forbidden("Your organization verification is pending admin review. We'll notify you once it's approved.");
    }
  }

  // Clear attempts + revoke old sessions in parallel, update last_active fire-and-forget
  await Promise.all([
    prisma.loginAttempt.deleteMany({ where: { email: emailLower } }),
    revokeAllRefreshTokensForUser(user.id)
  ]);

  prisma.user.update({ where: { id: user.id }, data: { last_active_at: new Date() } })
    .catch(err => logger.error({ err }, "Failed to update last_active_at"));

  const access_token = signAccessToken(user);
  const refresh_token = await issueRefreshToken(user.id);

  return { access_token, refresh_token, user: omitSensitive(user) };
}

export async function refresh(token: string) {
  let result;
  try {
    result = await rotateRefreshToken(token);
  } catch (err: any) {
    throw Unauthorized(err?.message ?? "Invalid refresh token");
  }
  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (!user) throw Unauthorized("User no longer exists");
  if (user.status === "suspended") throw Unauthorized("Account is suspended");
  return {
    access_token: signAccessToken(user),
    refresh_token: result.newToken,
    user: omitSensitive(user)
  };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) await revokeRefreshToken(refreshToken);
  return { ok: true };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({
    where: { email_lower: email.trim().toLowerCase() },
    select: { id: true, email: true, full_name: true }
  });
  if (!user) return { ok: true };

  // Rate limit: max 3 reset emails per email per hour
  const hourStart = new Date(Date.now() - 60 * 60 * 1000);
  const recentResets = await prisma.passwordReset.count({
    where: { user_id: user.id, created_at: { gte: hourStart } }
  });
  if (recentResets >= 3) return { ok: true };

  const token = generateToken();
  await prisma.passwordReset.create({
    data: { user_id: user.id, token, expires_at: new Date(Date.now() + RESET_TTL_MS) }
  });

  const link = `${env.WEB_APP_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendMail({
      to: user.email,
      subject: "Reset your Sportzicon password",
      html: `<p>Hi ${escapeHtml(user.full_name)},</p>
             <p>We received a request to reset your Sportzicon password. Click the link below to set a new password. This link expires in <strong>30 minutes</strong>.</p>
             <p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#FA4D14;color:#fff;text-decoration:none;border-radius:4px;font-weight:bold;">Reset my password</a></p>
             <p>If the button above doesn't work, copy and paste this link into your browser:</p>
             <p style="word-break:break-all;color:#555;">${link}</p>
             <p>If you didn't request a password reset, you can safely ignore this email.</p>
             <p style="color:#888;font-size:12px;">Didn't receive this email? Check your <strong>spam or junk folder</strong>.</p>`,
      text: `Hi ${user.full_name},\n\nWe received a request to reset your Sportzicon password. This link expires in 30 minutes.\n\nReset my password:\n${link}\n\nIf you didn't request a password reset, you can safely ignore this email.\n\nDidn't receive this email? Check your spam or junk folder.`,
      user_id: user.id,
      email_type: "password_reset"
    });
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send password reset email");
  }
  return { ok: true };
}

export async function resetPassword(token: string, password: string) {
  const record = await prisma.passwordReset.findUnique({ where: { token } });
  if (!record) throw BadRequest("Invalid reset token");
  if (record.used) throw BadRequest("This link has already been used");
  if (record.expires_at < new Date()) throw BadRequest("This link has expired");

  const hash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user_id }, data: { password_hash: hash } }),
    prisma.passwordReset.update({ where: { token }, data: { used: true } })
  ]);
  await revokeAllRefreshTokensForUser(record.user_id);
  return { ok: true };
}

// ── Two-step registration ─────────────────────────────────────────────────

export async function registerBasic(input: {
  user_id?: string;
  email: string; password: string; full_name: string; phone: string;
  role: Role; country?: string; state?: string; city?: string; dob?: string; gender?: string;
}) {
  const email = input.email.trim();
  const emailLower = email.toLowerCase();

  // If resuming (user_id present), verify the record is still pending and belongs to this email/phone
  if (input.user_id) {
    const existing = await prisma.user.findUnique({
      where: { id: input.user_id },
      select: { id: true, status: true, email_lower: true }
    });
    if (existing && existing.status === "pending") {
      // Check email conflict excluding self
      const emailTaken = await prisma.user.findFirst({
        where: { email_lower: emailLower, NOT: { id: input.user_id } },
        select: { id: true }
      });
      if (emailTaken) throw Conflict("An account with this email already exists");

      const phoneTaken = await prisma.user.findFirst({
        where: { phone: input.phone, NOT: { id: input.user_id } },
        select: { id: true }
      });
      if (phoneTaken) throw Conflict("An account with this mobile number already exists");

      const password_hash = await hashPassword(input.password);
      await prisma.user.update({
        where: { id: input.user_id },
        data: {
          email, email_lower: emailLower,
          phone: input.phone, password_hash,
          full_name: input.full_name,
          full_name_lower: input.full_name.toLowerCase(),
          role: input.role,
          country: input.country, state: input.state, city: input.city,
          dob: input.dob, gender: input.gender
        }
      });
      return { user_id: input.user_id };
    }
  }

  // Check if the email already exists
  const existingByEmail = await prisma.user.findFirst({
    where: { email_lower: emailLower },
    select: { id: true, status: true }
  });

  if (existingByEmail) {
    // Active / suspended account — hard conflict
    if (existingByEmail.status !== "pending") {
      throw Conflict("An account with this email already exists");
    }
    // Pending account = incomplete signup — let the user choose to resume
    // Do NOT overwrite previously saved data; just return the existing user_id
    return { user_id: existingByEmail.id, resumed: true };
  }

  // Completely new registration — check phone uniqueness
  const phoneTaken = await prisma.user.findFirst({
    where: { phone: input.phone },
    select: { id: true }
  });
  if (phoneTaken) throw Conflict("An account with this mobile number already exists");

  const password_hash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email, email_lower: emailLower,
      email_verified: false,
      phone: input.phone, password_hash,
      full_name: input.full_name,
      full_name_lower: input.full_name.toLowerCase(),
      role: input.role, status: "pending",
      country: input.country, state: input.state, city: input.city,
      dob: input.dob, gender: input.gender
    }
  });
  return { user_id: user.id, resumed: false };
}

export async function registerProfile(input: {
  user_id: string;
  primary_sport?: string; position?: string; experience_level?: string; looking_for_club?: boolean;
  org_name?: string; org_type?: string; org_sport?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.user_id },
    select: { id: true, status: true, email: true, full_name: true, role: true }
  });
  if (!user) throw NotFound("Registration session not found. Please start again.");
  if (user.status !== "pending") throw Conflict("Account is already active.");

  const athleteData =
    user.role === "athlete" && input.primary_sport
      ? {
          primary_sport: input.primary_sport,
          position: input.position ?? "",
          experience_level: input.experience_level ?? "amateur",
          looking_for_club: input.looking_for_club ?? false,
          availability: "available",
          stats: {}
        }
      : undefined;

  if (athleteData) {
    const violations = validateAthleteSportProfile(athleteData);
    if (violations.length) throw BadRequest(violations.join(" "));
  }

  if (athleteData) {
    await prisma.user.update({
      where: { id: input.user_id },
      data: { athlete_data: athleteData as object }
    });
  }

  // Org details from signup live on Organization, not User. Skip creation if the
  // user resumed a pending signup and already has one.
  if (input.org_name && (user.role === "club" || user.role === "organizer")) {
    const existingOrg = await prisma.organization.findFirst({
      where: { owner_user_id: user.id },
      select: { id: true }
    });
    if (!existingOrg) {
      await createOrganization(user.id, user.role, {
        org_name: input.org_name,
        org_type: input.org_type ?? "club",
        sport_categories: input.org_sport ? [input.org_sport] : []
      });
    }
  }

  await issueAndSendVerificationEmail(user.id, user.email, user.full_name);
  return { ok: true, email: user.email };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function checkAvailability(email?: string, phone?: string) {
  const [emailExists, phoneExists] = await Promise.all([
    email
      ? prisma.user.findFirst({ where: { email_lower: email.trim().toLowerCase() }, select: { id: true } })
      : null,
    phone
      ? prisma.user.findFirst({ where: { phone }, select: { id: true } })
      : null
  ]);

  const result: { email?: "available" | "taken"; phone?: "available" | "taken" } = {};
  if (email) result.email = emailExists ? "taken" : "available";
  if (phone) result.phone = phoneExists ? "taken" : "available";
  return result;
}

export async function changePassword(userId: string, current: string, next_: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound("User not found");
  const ok = await comparePassword(current, user.password_hash);
  if (!ok) throw Unauthorized("Current password is incorrect");
  const hash = await hashPassword(next_);
  await prisma.user.update({ where: { id: userId }, data: { password_hash: hash } });
  await revokeAllRefreshTokensForUser(userId);
  return { ok: true };
}

export async function bootstrapAdminIfNeeded() {
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) return;
  const existing = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  if (existing) return;

  const password_hash = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD);
  await prisma.user.create({
    data: {
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      email_lower: env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase(),
      email_verified: true,
      phone: "+0000000000",
      password_hash,
      full_name: "Sportzicon Admin",
      full_name_lower: "sportzicon admin",
      role: "admin",
      status: "active",
      verification_status: "approved",
      verification_badges: ["verified_admin"]
    }
  });
  logger.warn({ email: env.BOOTSTRAP_ADMIN_EMAIL }, "Bootstrapped admin account. CHANGE THE PASSWORD IMMEDIATELY.");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
