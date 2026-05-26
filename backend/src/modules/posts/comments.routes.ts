import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./posts.service";

const router = Router();

const idParam = z.object({ id: z.string().min(8) });
const updateSchema = z.object({ text: z.string().min(1).max(2000) });

router.put(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.updateComment(req.params.id, req.user!.sub, req.user!.role === "admin", req.body.text);
    res.json(r);
  })
);

router.delete(
  "/:id",
  requireAuth,
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteComment(req.params.id, req.user!.sub, req.user!.role === "admin");
    res.json(r);
  })
);

export default router;
