import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./blogs.service";
import { createBlogSchema, updateBlogSchema, listBlogsSchema } from "./blogs.schemas";
import { addComment, listComments } from "../posts/comments.service";

const router = Router();

router.post(
  "/",
  requireAuth,
  validate(createBlogSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createBlog(req.user!.sub, req.body);
    res.status(201).json({ blog: r });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(updateBlogSchema),
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
  validate(listBlogsSchema, "query"),
  asyncHandler(async (req, res) => {
    const actor = req.user ? { id: req.user.sub, role: req.user.role } : undefined;
    const r = await svc.listBlogs(req.query as any, actor);
    res.json(r);
  })
);

router.get(
  "/:idOrSlug",
  optionalAuth,
  validate(z.object({ idOrSlug: z.string().min(1) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getBlog(req.params.idOrSlug);
    // If logged in, check liked status
    let liked = false;
    if (req.user) {
      liked = await svc.checkLiked(r.id, req.user.sub);
    }
    res.json({ blog: { ...r, liked } });
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
  optionalAuth,
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const r = await listComments("blog", req.params.id, { cursor, limit });
    res.json(r);
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
