import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { createReport } from "./admin.service";

const router = Router();

router.post(
  "/",
  requireAuth,
  validate(
    z.object({
      target_type: z.enum(["user", "organization", "post", "reel", "blog", "message", "opportunity"]),
      target_id: z.string().min(1),
      reason: z.string().min(3).max(2000)
    })
  ),
  asyncHandler(async (req, res) => {
    const r = await createReport(req.user!.sub, req.body);
    res.status(201).json({ report: r });
  })
);

export default router;
