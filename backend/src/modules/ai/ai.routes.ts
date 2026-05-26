import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { getAthleteTips } from "./ai.service";

const router = Router();

router.post(
  "/athlete-tips",
  requireAuth,
  requireRole("athlete"),
  asyncHandler(async (req, res) => {
    const r = await getAthleteTips(req.user!.sub);
    res.json(r);
  })
);

export default router;
