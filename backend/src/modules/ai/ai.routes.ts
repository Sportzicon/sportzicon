import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ROLES } from "../../utils/roles";
import { getAthleteTips } from "./ai.service";

const router = Router();

router.post(
  "/athlete-tips",
  requireAuth,
  requireRole(...ROLES.ATHLETES_AND_ADMIN),
  asyncHandler(async (req, res) => {
    const r = await getAthleteTips(req.user!.sub);
    res.json(r);
  })
);

export default router;
