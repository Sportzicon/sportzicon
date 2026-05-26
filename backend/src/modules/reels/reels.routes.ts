import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./reels.service";
import { addComment, listComments } from "../posts/posts.service";

const router = Router();

const createSchema = z.object({
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  caption: z.string().max(2000).optional(),
  duration_seconds: z.number().int().positive().max(180).optional(),
  sport: z.string().max(60).optional()
});

const listQuery = z.object({
  author_id: z.string().optional(),
  sport: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
});

router.post(
  "/",
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createReel(req.user!.sub, req.body);
    res.status(201).json({ reel: r });
  })
);

router.get(
  "/",
  requireAuth,
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listReels(req.query as any);
    res.json(r);
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteReel(req.params.id, req.user!.sub, req.user!.role === "admin");
    res.json(r);
  })
);

router.post(
  "/:id/view",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.viewReel(req.params.id);
    res.json(r);
  })
);

router.post(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.likeReel(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.delete(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.unlikeReel(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.get(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const items = await listComments("reel", req.params.id);
    res.json({ items });
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ text: z.string().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const r = await addComment({ type: "reel", id: req.params.id }, req.user!.sub, req.body.text);
    res.status(201).json({ comment: r });
  })
);

export default router;
