import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./posts.service";
import * as commentSvc from "./comments.service";

const router = Router();

const createSchema = z.object({
  type: z.enum(["log", "post"]).default("post"),
  text: z.string().min(1).max(2000).trim(),
  media_urls: z.array(z.string().url()).max(10).optional(),
  sport: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(20).optional()
});

const updateSchema = z.object({
  text: z.string().min(1).max(4000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional()
});

const listQuery = z.object({
  author_id: z.string().optional(),
  sport: z.string().optional(),
  type: z.enum(["log", "post"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
});

router.post(
  "/",
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createPost(req.user!.sub, req.body);
    res.status(201).json({ post: r });
  })
);

router.get(
  "/",
  requireAuth,
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listPosts(req.query as any);
    res.json(r);
  })
);

router.get(
  "/feed",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const r = await svc.feedForUser(req.user!.sub, limit, cursor);
    res.json(r);
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updatePost(req.params.id, req.user!.sub, req.user!.role === "admin", req.body);
    res.json(r);
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deletePost(req.params.id, req.user!.sub, req.user!.role === "admin");
    res.json(r);
  })
);

router.post(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.likePost(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.delete(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.unlikePost(req.params.id, req.user!.sub);
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
    const r = await commentSvc.listComments("post", req.params.id, { cursor, limit, userId: req.user!.sub });
    res.json(r);
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ text: z.string().min(1).max(1000).trim() })),
  asyncHandler(async (req, res) => {
    const r = await commentSvc.addComment({ type: "post", id: req.params.id }, req.user!.sub, req.body.text);
    res.status(201).json({ comment: r });
  })
);

export default router;
