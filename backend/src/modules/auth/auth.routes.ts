import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { authLimiter } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/auth";
import * as svc from "./auth.service";
import { getUserById } from "../users/users.service";
import {
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  checkAvailabilitySchema,
  registerBasicSchema,
  registerProfileSchema
} from "./auth.schemas";

const router = Router();

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
    res.json(r);
  })
);

router.post(
  "/refresh",
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.refresh(req.body.refresh_token);
    res.json(r);
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await svc.logout(req.body?.refresh_token);
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
    const user = await getUserById(req.user!.sub);
    res.json({ user });
  })
);

export default router;
