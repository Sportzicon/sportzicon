import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./organizations.service";
import { createOrgSchema, updateOrgSchema } from "./organizations.schemas";

const router = Router();

router.post(
  "/",
  requireAuth,
  requireRole("club", "organizer"),
  validate(createOrgSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createOrganization(req.user!.sub, req.user!.role, req.body);
    res.status(201).json({ organization: r });
  })
);

router.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    const orgs = await svc.listOrganizationsForOwner(req.user!.sub);
    res.json({ items: orgs });
  })
);

router.get(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const org = await svc.getOrganization(req.params.id);
    res.json({ organization: org });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(updateOrgSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateOrganization(req.params.id, req.user!.sub, req.user!.role, req.body);
    res.json({ organization: r });
  })
);

export default router;
