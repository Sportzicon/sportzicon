import { Router, type Response } from "express";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { authLimiter } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/auth";
import { Unauthorized } from "../../utils/errors";
import { env, isProd } from "../../config/env";
import { parseTtlMs } from "./tokens";
import * as svc from "./auth.service";
import { getUserById } from "../users/users.service";
import {
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  checkAvailabilitySchema,
  registerBasicSchema,
  registerProfileSchema,
  guardianConsentConfirmSchema
} from "./auth.schemas";

const router = Router();

const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
    domain: env.COOKIE_DOMAIN,
    maxAge: parseTtlMs(env.JWT_REFRESH_TTL)
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: REFRESH_COOKIE_PATH,
    domain: env.COOKIE_DOMAIN
  });
}

router.post(
  "/check-availability",
  authLimiter,
  validate(checkAvailabilitySchema),
  asyncHandler(async (req, res) => {
    const r = await svc.checkAvailability(req.body.email, req.body.phone);
    res.json(r);
  })
);

// Step-1: save basic account details (email, phone, password, location)
router.post(
  "/register/basic",
  authLimiter,
  validate(registerBasicSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.registerBasic(req.body);
    res.status(201).json(r);
  })
);

// Step-2: save sport profile / org details and trigger email verification
router.post(
  "/register/profile",
  authLimiter,
  validate(registerProfileSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.registerProfile(req.body);
    res.json(r);
  })
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.login(req.body.email, req.body.password);
    setRefreshCookie(res, r.refresh_token);
    res.json({ access_token: r.access_token, user: r.user });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw Unauthorized("Session expired, please log in again");
    const r = await svc.refresh(token);
    setRefreshCookie(res, r.refresh_token);
    res.json({ access_token: r.access_token, user: r.user });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await svc.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.json({ ok: true });
  })
);

router.post(
  "/verify-email",
  authLimiter,
  validate(verifyEmailSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.verifyEmail(req.body.token);
    res.json(r);
  })
);

router.post(
  "/guardian-consent/confirm",
  authLimiter,
  validate(guardianConsentConfirmSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.confirmGuardianConsent(req.body.token);
    res.json(r);
  })
);

router.post(
  "/resend-verification",
  authLimiter,
  validate(forgotPasswordSchema), // same shape (just email)
  asyncHandler(async (req, res) => {
    const r = await svc.resendVerification(req.body.email);
    res.json(r);
  })
);

router.post(
  "/forgot-password",
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.forgotPassword(req.body.email);
    res.json(r);
  })
);

router.post(
  "/reset-password",
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.resetPassword(req.body.token, req.body.password);
    res.json(r);
  })
);

router.post(
  "/change-password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.changePassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
    res.json(r);
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.user!.sub, { id: req.user!.sub, role: req.user!.role });
    res.json({ user });
  })
);

export default router;
