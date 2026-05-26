import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { authLimiter } from "../../middleware/rateLimit";
import { requireAuth } from "../../middleware/auth";
import * as svc from "./auth.service";
import {
  signupSchema,
  loginSchema,
  refreshSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema
} from "./auth.schemas";

const router = Router();

router.post(
  "/signup",
  authLimiter,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.signup(req.body);
    res.status(201).json(result);
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
    const { db, Collections } = await import("../../config/firestore");
    const snap = await db.collection(Collections.users).doc(req.user!.sub).get();
    if (!snap.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    res.json({ user: svc.publicUser(snap.data() as any) });
  })
);

export default router;
