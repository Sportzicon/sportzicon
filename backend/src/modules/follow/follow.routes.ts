import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./follow.service";

const router = Router();
const idParam = z.object({ id: z.string().min(8) });
const paging = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), cursor: z.string().optional() });

router.post(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.follow(req.user!.sub, req.params.id);
    res.json(r);
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.unfollow(req.user!.sub, req.params.id);
    res.json(r);
  })
);

router.get(
  "/:id/followers",
  requireAuth,
  validate(idParam, "params"),
  validate(paging, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listFollowers(req.params.id, Number(req.query.limit) || 50);
    res.json(r);
  })
);

router.get(
  "/:id/following",
  requireAuth,
  validate(idParam, "params"),
  validate(paging, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listFollowing(req.params.id, Number(req.query.limit) || 50);
    res.json(r);
  })
);

router.get(
  "/status/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const following = await svc.isFollowing(req.user!.sub, req.params.id);
    res.json({ following });
  })
);

export default router;
