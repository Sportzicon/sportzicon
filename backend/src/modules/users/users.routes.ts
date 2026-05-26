import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import * as svc from "./users.service";
import {
  updateProfileSchema,
  athleteFieldsSchema,
  coachFieldsSchema,
  userIdParamSchema
} from "./users.schemas";

const router = Router();

// Public read: anyone (authenticated) can view a user profile.
router.get(
  "/:id",
  requireAuth,
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const u = await svc.getUserById(req.params.id);
    res.json({ user: u });
  })
);

router.put(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateProfile(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

router.put(
  "/me/athlete",
  requireAuth,
  validate(athleteFieldsSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateAthleteFields(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

router.put(
  "/me/coach",
  requireAuth,
  validate(coachFieldsSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateCoachFields(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

export default router;
