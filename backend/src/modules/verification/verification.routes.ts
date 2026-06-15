import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./verification.service";

const router = Router();

const submitSchema = z.object({
  entity_type: z.enum(["user", "organization"]),
  entity_id: z.string().min(8),
  verification_type: z.string().min(2).max(40),
  documents: z.array(z.string().url()).min(1).max(10),
  notes: z.string().max(2000).optional()
});

const reviewSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional()
});

router.post(
  "/",
  requireAuth,
  validate(submitSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.submit({ ...req.body, actorId: req.user!.sub, actorRole: req.user!.role });
    res.status(201).json({ verification: r });
  })
);

router.get(
  "/pending",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const items = await svc.listPending(Math.min(Number(req.query.limit) || 100, 200));
    res.json({ items });
  })
);

router.post(
  "/:id/review",
  requireAuth,
  requireRole("admin"),
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.review(req.params.id, req.user!.sub, req.body.decision, req.body.reason);
    res.json({ verification: r });
  })
);

router.patch(
  "/:orgId/approve",
  requireAuth,
  requireRole("admin"),
  validate(z.object({ orgId: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.approveOrg(req.params.orgId, req.user!.sub);
    res.json(r);
  })
);

router.patch(
  "/:orgId/reject",
  requireAuth,
  requireRole("admin"),
  validate(z.object({ orgId: z.string().min(8) }), "params"),
  validate(z.object({ reason: z.string().min(10).max(1000) })),
  asyncHandler(async (req, res) => {
    const r = await svc.rejectOrg(req.params.orgId, req.user!.sub, req.body.reason);
    res.json(r);
  })
);

export default router;
