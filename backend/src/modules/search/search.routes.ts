import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./search.service";

const router = Router();

const playerSearchQ = z.object({
  q: z.string().max(120).optional(),
  sport: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  age_min: z.coerce.number().int().min(0).max(120).optional(),
  age_max: z.coerce.number().int().min(0).max(120).optional(),
  experience_level: z.enum(["beginner", "amateur", "semi_pro", "professional"]).optional(),
  position: z.string().optional(),
  available: z.coerce.boolean().optional(),
  verified: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20)
});

const clubSearchQ = z.object({
  q: z.string().max(120).optional(),
  sport: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  org_type: z.enum(["club", "academy", "both"]).optional(),
  verified: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const oppSearchQ = z.object({
  q: z.string().max(120).optional(),
  sport: z.string().optional(),
  type: z.enum(["trial", "recruitment", "scholarship", "tournament", "coaching_job"]).optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["open", "closed", "filled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

router.get(
  "/players",
  requireAuth,
  validate(playerSearchQ, "query"),
  asyncHandler(async (req, res) => {
    const items = await svc.searchPlayers(req.query as any);
    res.json({ items });
  })
);

router.get(
  "/clubs",
  requireAuth,
  validate(clubSearchQ, "query"),
  asyncHandler(async (req, res) => {
    const items = await svc.searchClubs(req.query as any);
    res.json({ items });
  })
);

router.get(
  "/opportunities",
  requireAuth,
  validate(oppSearchQ, "query"),
  asyncHandler(async (req, res) => {
    const items = await svc.searchOpportunities(req.query as any);
    res.json({ items });
  })
);

export default router;
