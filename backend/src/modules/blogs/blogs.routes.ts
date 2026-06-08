import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./blogs.service";
import { addComment, listComments } from "../posts/comments.service";

const router = Router();

const createSchema = z.object({
  title: z.string().min(3).max(180),
  body_markdown: z.string().min(20).max(50000),
  excerpt: z.string().max(280).optional(),
  cover_image_url: z.string().url().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  sport: z.string().max(60).optional(),
  status: z.enum(["draft", "published"]).default("draft")
});

const updateSchema = createSchema.partial();

const listQuery = z.object({
  author_id: z.string().optional(),
  tag: z.string().optional(),
  sport: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional()
});

router.post(
  "/",
  requireAuth,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createBlog(req.user!.sub, req.body);
    res.status(201).json({ blog: r });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateBlog(req.params.id, req.user!.sub, req.user!.role === "admin", req.body);
    res.json({ blog: r });
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteBlog(req.params.id, req.user!.sub, req.user!.role === "admin");
    res.json(r);
  })
);

router.get(
  "/",
  optionalAuth,
  validate(listQuery, "query"),
  asyncHandler(async (req, res) => {
    const r = await svc.listBlogs(req.query as any);
    res.json(r);
  })
);

router.get(
  "/:idOrSlug",
  optionalAuth,
  validate(z.object({ idOrSlug: z.string().min(1) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getBlog(req.params.idOrSlug);
    res.json({ blog: r });
  })
);

router.post(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.likeBlog(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.delete(
  "/:id/like",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.unlikeBlog(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.get(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const items = await listComments("blog", req.params.id);
    res.json({ items });
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ text: z.string().min(1).max(2000) })),
  asyncHandler(async (req, res) => {
    const r = await addComment({ type: "blog", id: req.params.id }, req.user!.sub, req.body.text);
    res.status(201).json({ comment: r });
  })
);

export default router;
