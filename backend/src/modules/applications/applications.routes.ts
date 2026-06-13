import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { ROLES } from "../../utils/roles";
import * as svc from "./applications.service";

const router = Router();

const applySchema = z.object({
  cover_note: z.string().max(2000).optional(),
  documents: z.array(z.string().url()).max(10).optional()
});

const transitionSchema = z.object({
  status: z.enum(["shortlisted", "selected", "rejected", "withdrawn"]),
  reason: z.string().max(500).optional()
});

router.post(
  "/opportunities/:opportunityId/apply",
  requireAuth,
  requireRole(...ROLES.ATHLETES_AND_ADMIN),
  validate(z.object({ opportunityId: z.string().min(8) }), "params"),
  validate(applySchema),
  asyncHandler(async (req, res) => {
    const r = await svc.apply(req.user!.sub, req.params.opportunityId, req.body);
    res.status(201).json({ application: r });
  })
);

router.get(
  "/applications/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await svc.listMyApplications(req.user!.sub);
    res.json({ items });
  })
);

router.get(
  "/applications/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getApplication(req.params.id, { id: req.user!.sub, role: req.user!.role });
    res.json({ application: r });
  })
);

router.patch(
  "/applications/:id/status",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(transitionSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.transition(
      req.params.id,
      { id: req.user!.sub, role: req.user!.role },
      req.body.status,
      req.body.reason
    );
    res.json({ application: r });
  })
);

router.get(
  "/opportunities/:opportunityId/applicants",
  requireAuth,
  validate(z.object({ opportunityId: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const items = await svc.listApplicantsForOpportunity(req.params.opportunityId, {
      id: req.user!.sub,
      role: req.user!.role
    });
    res.json({ items });
  })
);

export default router;
