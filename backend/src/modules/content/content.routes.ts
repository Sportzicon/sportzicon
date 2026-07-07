import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { Unauthorized } from "../../utils/errors";
import * as svc from "./content.service";
import * as commentSvc from "./comments.service";
import { createContentSchema, updateContentSchema, listContentSchema, type ListContentInput } from "./content.schemas";

const router = Router();
const idParam = z.object({ id: z.string().min(8) });

router.post(
  "/",
  requireAuth,
  validate(createContentSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.createContent(req.user!.sub, req.body);
    res.status(201).json({ content: r });
  })
);

// Follows-based feed — posts only, matches the original /posts/feed behavior.
router.get(
  "/feed",
  requireAuth,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const r = await svc.getFeedForUser(req.user!.sub, limit, cursor);
    res.json(r);
  })
);

router.get(
  "/",
  optionalAuth,
  validate(listContentSchema, "query"),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ListContentInput;
    // Only blogs are publicly listable; post/reel/mixed listing requires auth
    // (matches the original posts/reels modules, which were auth-only).
    if (q.content_type !== "blog" && !req.user) throw Unauthorized();

    const actor = req.user ? { id: req.user.sub, role: req.user.role } : undefined;
    const r = await svc.listContent(q, actor);
    res.json(r);
  })
);

router.get(
  "/:idOrSlug",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const content = await svc.getContentByIdOrSlug(req.params.idOrSlug, { userId: req.user?.sub });
    if (content.content_type !== "blog" && !req.user) throw Unauthorized();
    res.json({ content });
  })
);

router.put(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  validate(updateContentSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateContent(req.params.id, req.user!.sub, req.user!.role === "admin", req.body);
    res.json(r);
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteContent(req.params.id, req.user!.sub, req.user!.role === "admin");
    res.json(r);
  })
);

router.post(
  "/:id/like",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.likeContent(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.delete(
  "/:id/like",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.unlikeContent(req.params.id, req.user!.sub);
    res.json(r);
  })
);

router.get(
  "/:id/comments",
  optionalAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const cursor = req.query.cursor as string | undefined;
    const r = await commentSvc.listComments(req.params.id, { cursor, limit, userId: req.user?.sub });
    res.json(r);
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  validate(idParam, "params"),
  validate(z.object({ text: z.string().min(1).max(2000).trim() })),
  asyncHandler(async (req, res) => {
    const r = await commentSvc.addComment(req.params.id, req.user!.sub, req.body.text);
    res.status(201).json({ comment: r });
  })
);

export default router;
