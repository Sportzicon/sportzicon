import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ROLES } from "../../utils/roles";
import * as svc from "./documentAccess.service";
import {
  requestAccessSchema,
  athleteIdParamSchema,
  requestIdParamSchema,
  listQuerySchema,
  decisionBodySchema,
} from "./documentAccess.schemas";

const router = Router();

router.post(
  "/:athleteId/requests",
  requireAuth,
  requireRole(...ROLES.RECRUITERS),
  validate(athleteIdParamSchema, "params"),
  validate(requestAccessSchema),
  asyncHandler(async (req, res) => {
    const request = await svc.requestAccess(
      req.user!.sub,
      req.user!.role,
      req.params.athleteId,
      req.body.reason
    );
    res.status(201).json({ request });
  })
);

router.get(
  "/:athleteId/requests",
  requireAuth,
  validate(athleteIdParamSchema, "params"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const items = await svc.listForAthlete(
      req.params.athleteId,
      { id: req.user!.sub, role: req.user!.role },
      req.query.status as any
    );
    res.json({ items });
  })
);

router.get(
  "/:athleteId/my-status",
  requireAuth,
  requireRole(...ROLES.RECRUITERS),
  validate(athleteIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const result = await svc.getMyStatus(req.user!.sub, req.params.athleteId);
    res.json(result);
  })
);

router.patch(
  "/requests/:requestId",
  requireAuth,
  requireRole(...ROLES.ATHLETES_AND_ADMIN),
  validate(requestIdParamSchema, "params"),
  validate(decisionBodySchema),
  asyncHandler(async (req, res) => {
    const request = await svc.decide(
      req.params.requestId,
      { id: req.user!.sub, role: req.user!.role },
      req.body.status
    );
    res.json({ request });
  })
);

export default router;
