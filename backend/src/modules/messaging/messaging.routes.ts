import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./messaging.service";

const router = Router();

// List conversations for the current user
router.get(
  "/conversations",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await svc.listConversations(req.user!.sub);
    res.json({ items });
  })
);

// Create a conversation (without sending a message)
router.post(
  "/conversations",
  requireAuth,
  validate(z.object({ recipient_id: z.string().uuid() })),
  asyncHandler(async (req, res) => {
    const result = await svc.createConversation({ id: req.user!.sub, role: req.user!.role }, req.body.recipient_id);
    res.status(result.created ? 201 : 200).json(result);
  })
);

// Send a message (creates conversation if needed)
router.post(
  "/messages",
  requireAuth,
  validate(z.object({
    recipient_id: z.string().uuid(),
    body: z.string().min(1).max(5000).trim()
  })),
  asyncHandler(async (req, res) => {
    const r = await svc.sendMessage({ id: req.user!.sub, role: req.user!.role }, req.body.recipient_id, req.body.body);
    res.status(201).json(r);
  })
);

// Get messages in a conversation (paginated)
router.get(
  "/conversations/:id/messages",
  requireAuth,
  validate(z.object({ id: z.string().uuid() }), "params"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const r = await svc.listMessages(
      req.user!.sub,
      req.params.id,
      limit,
      req.query.cursor as string | undefined
    );
    res.json(r);
  })
);

// Mark conversation as read
router.post(
  "/conversations/:id/read",
  requireAuth,
  validate(z.object({ id: z.string().uuid() }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.markRead(req.user!.sub, req.params.id);
    res.json(r);
  })
);

export default router;
