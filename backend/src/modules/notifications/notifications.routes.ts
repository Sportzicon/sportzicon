import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./notifications.service";

const router = Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const page = await svc.listForUser(req.user!.sub, limit, cursor);
    res.json(page);
  })
);

router.get(
  "/count",
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await svc.countUnread(req.user!.sub);
    res.json({ unread: count });
  })
);

router.patch(
  "/read-all",
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await svc.markRead(req.user!.sub, []);
    res.json(r);
  })
);

router.patch(
  "/:id/read",
  requireAuth,
  asyncHandler(async (req, res) => {
    const r = await svc.markOneRead(req.user!.sub, req.params.id);
    res.json(r);
  })
);

// Legacy endpoint kept for backwards compat
router.post(
  "/read",
  requireAuth,
  validate(z.object({ ids: z.array(z.string()).optional() })),
  asyncHandler(async (req, res) => {
    const r = await svc.markRead(req.user!.sub, req.body.ids ?? []);
    res.json(r);
  })
);

export default router;
