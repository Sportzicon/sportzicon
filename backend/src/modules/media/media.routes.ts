import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./media.service";
import { env } from "../../config/env";

const router = Router();

const uploadSchema = z.object({
  category: z.enum(["image", "video", "document"]),
  filename: z.string().min(1).max(200),
  content_type: z.string().min(3).max(120),
  content_length: z.coerce.number().int().positive().max(env.MAX_UPLOAD_MB * 1024 * 1024)
});

router.post(
  "/upload-url",
  requireAuth,
  validate(uploadSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.getUploadUrl({
      userId: req.user!.sub,
      category: req.body.category,
      filename: req.body.filename,
      contentType: req.body.content_type,
      contentLength: req.body.content_length
    });
    res.json(r);
  })
);

router.get(
  "/read-url",
  requireAuth,
  validate(
    z.object({
      category: z.enum(["image", "video", "document"]),
      object_name: z.string().min(1).max(500)
    }),
    "query"
  ),
  asyncHandler(async (req, res) => {
    const url = await svc.getReadUrl(req.query.category as any, req.query.object_name as string);
    res.json({ url });
  })
);

export default router;
