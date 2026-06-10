import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole, optionalAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./opportunities.service";
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  listOpportunitiesQuery
} from "./opportunities.schemas";

const router = Router();
const idParam = z.object({ id: z.string().min(8) });

router.post(
  "/",
  requireAuth,
  requireRole("club", "organizer", "admin"),
  validate(createOpportunitySchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createOpportunity(req.user!.sub, req.user!.role, req.body);
    res.status(201).json({ opportunity: r });
  })
);

router.get(
  "/",
  optionalAuth,
  validate(listOpportunitiesQuery, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listOpportunities(req.query as any);
    res.json(r);
  })
);

router.get(
  "/:id",
  optionalAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getOpportunity(req.params.id);
    res.json({ opportunity: r });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  validate(updateOpportunitySchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateOpportunity(req.params.id, req.user!.sub, req.user!.role, req.body);
    res.json({ opportunity: r });
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteOpportunity(req.params.id, req.user!.sub, req.user!.role);
    res.json(r);
  })
);

export default router;
