import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { ROLES } from "../../utils/roles";
import * as svc from "./tournaments.service";
import {
  createOrgTournamentSchema,
  updateOrgTournamentSchema,
  createOrgTeamSchema,
  listOrgTournamentsQuerySchema
} from "./tournaments.schemas";

const router = Router();
const idParams = z.object({ id: z.string().min(8) });
const orgIdParams = z.object({ orgId: z.string().min(8) });
const teamParams = z.object({ id: z.string().min(8), teamId: z.string().min(8) });

// Global cross-org feed — must be registered before "/org-tournaments/:id"
// so Express doesn't try to match "org-tournaments" itself as an :id.
router.get(
  "/org-tournaments",
  requireAuth,
  validate(listOrgTournamentsQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listAllOrgTournaments(req.query as any);
    res.json(r);
  })
);

// Nested under the parent organization — matches Opportunity/Organization's own nesting style.
router.post(
  "/organizations/:orgId/org-tournaments",
  requireAuth,
  requireRole(...ROLES.CLUB_MANAGERS),
  validate(orgIdParams, "params"),
  validate(createOrgTournamentSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createOrgTournament(req.params.orgId, req.user!.sub, req.user!.role, req.body);
    res.status(201).json({ tournament: r });
  })
);

router.get(
  "/organizations/:orgId/org-tournaments",
  requireAuth,
  validate(orgIdParams, "params"),
  asyncHandler(async (req, res) => {
    const items = await svc.listOrgTournaments(req.params.orgId);
    res.json({ items });
  })
);

router.get(
  "/org-tournaments/:id",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const tournament = await svc.getOrgTournament(req.params.id);
    res.json({ tournament });
  })
);

router.put(
  "/org-tournaments/:id",
  requireAuth,
  validate(idParams, "params"),
  validate(updateOrgTournamentSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateOrgTournament(req.params.id, req.user!.sub, req.user!.role, req.body);
    res.json({ tournament: r });
  })
);

router.delete(
  "/org-tournaments/:id",
  requireAuth,
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteOrgTournament(req.params.id, req.user!.sub, req.user!.role);
    res.json(r);
  })
);

router.post(
  "/org-tournaments/:id/teams",
  requireAuth,
  validate(idParams, "params"),
  validate(createOrgTeamSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.addOrgTeam(req.params.id, req.user!.sub, req.user!.role, req.body);
    res.status(201).json({ team: r });
  })
);

router.delete(
  "/org-tournaments/:id/teams/:teamId",
  requireAuth,
  validate(teamParams, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteOrgTeam(req.params.id, req.params.teamId, req.user!.sub, req.user!.role);
    res.json(r);
  })
);

export default router;
