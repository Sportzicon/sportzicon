import { Router } from "express";
import { asyncHandler } from "../../utils/async";
import * as svc from "./stats.service";

const router = Router();

// Public — powers marketing/landing page counters. No auth required.
router.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const r = await svc.publicStats();
    res.json(r);
  })
);

export default router;
