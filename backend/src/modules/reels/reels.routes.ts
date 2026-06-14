import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./reels.service";
import { addComment, listComments } from "../posts/comments.service";
import { ROLES } from "../../utils/roles";

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number().int().positive().max(180).optional(),
  sport: z.string().max(60).optional()
});

const updateSchema = z.object({
  title: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).optional(),
  sport: z.string().max(60).optional()
});

const listQuery = z.object({
  author_id: z.string().optional(),
  sport: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().optional()
});

router.post(
  "/",
  requireAuth,
  requireRole(...ROLES.ATHLETES_AND_ADMIN),
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

router.get(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getReel(req.params.id);
    res.json({ reel: r });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateReel(req.params.id, req.user!.sub, req.user!.role === "admin", req.body);
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
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const r = await listComments("reel", req.params.id, { cursor, limit });
    res.json(r);
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ text: z.string().min(1).max(1000) })),
  asyncHandler(async (req, res) => {
    const r = await addComment({ type: "reel", id: req.params.id }, req.user!.sub, req.body.text);
    res.status(201).json({ comment: r });
  })
);

export default router;
