import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./messaging.service";

const router = Router();

router.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await svc.listConversations(req.user!.sub);
    res.json({ items });
  })
);

router.post(
  "/messages",
  requireAuth,
  validate(z.object({ recipient_id: z.string().min(8), body: z.string().min(1).max(4000) })),
  asyncHandler(async (req, res) => {
    const r = await svc.sendMessage(req.user!.sub, req.body.recipient_id, req.body.body);
    res.status(201).json(r);
  })
);

router.get(
  "/conversations/:id/messages",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const r = await svc.listMessages(req.user!.sub, req.params.id, limit, req.query.cursor as string | undefined);
    res.json(r);
  })
);

router.post(
  "/conversations/:id/read",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.markRead(req.user!.sub, req.params.id);
    res.json(r);
  })
);

export default router;
