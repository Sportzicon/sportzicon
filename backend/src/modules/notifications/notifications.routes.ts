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
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const unreadOnly = req.query.unread === "true";
    const items = await svc.listForUser(req.user!.sub, limit, unreadOnly);
    res.json({ items });
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
