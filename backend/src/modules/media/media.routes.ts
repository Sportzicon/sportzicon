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

router.post(
  "/upload",
  requireAuth,
  asyncHandler(async (req, res) => {
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === "string") {
      buffer = Buffer.from(req.body);
    } else {
      buffer = Buffer.from(JSON.stringify(req.body));
    }

    const public_url = await svc.uploadFile({
      userId: req.user!.sub,
      category: (req.query.category as any) || "image",
      filename: (req.query.filename as string) || "upload",
      contentType: (req.query.content_type as string) || req.headers["content-type"] || "application/octet-stream",
      buffer
    });
    res.json({ public_url });
  })
);

export default router;
