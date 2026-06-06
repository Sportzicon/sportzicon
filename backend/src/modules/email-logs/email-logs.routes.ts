import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async";
import { Forbidden } from "../../utils/errors";
import * as svc from "./email-logs.service";

const router = Router();

// GET /api/v1/users/:id/email-logs — user sees their own; admin sees anyone's
router.get(
  "/users/:id/email-logs",
  requireAuth,
  asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (req.user!.sub !== targetId && req.user!.role !== "admin") {
      throw Forbidden();
    }
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const [data, stats] = await Promise.all([
      svc.listForUser(targetId, limit, offset),
      svc.statsForUser(targetId)
    ]);
    res.json({ ...data, stats });
  })
);

// GET /api/v1/email-logs — admin only global view
router.get(
  "/email-logs",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const [data, stats] = await Promise.all([
      svc.listAll(limit, offset, status),
      svc.globalStats()
    ]);
    res.json({ ...data, stats });
  })
);

export default router;
