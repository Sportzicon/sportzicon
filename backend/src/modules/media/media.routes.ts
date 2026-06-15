import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./media.service";
import { uploadUrlSchema, confirmUploadSchema } from "./media.schemas";

const router = Router();

// POST /media/upload-url — returns a GCS signed PUT URL for the client to upload directly
router.post(
  "/upload-url",
  requireAuth,
  validate(uploadUrlSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.getUploadUrl({
      userId: req.user!.sub,
      context: req.body.context,
      fileName: req.body.fileName,
      contentType: req.body.contentType,
    });
    res.json(r);
  }),
);

// POST /media/confirm — verify file landed in GCS, return public URL
router.post(
  "/confirm",
  requireAuth,
  validate(confirmUploadSchema),
  asyncHandler(async (req, res) => {
    const r = await svc.confirmUpload(req.body.key, req.body.context);
    res.json(r);
  }),
);

// GET /media/download-url/:key — generate a short-lived signed URL for a private org document
router.get(
  "/download-url/:key",
  requireAuth,
  validate(z.object({ key: z.string().min(1) }), "params"),
  asyncHandler(async (req, res) => {
    const url = await svc.getPrivateDownloadUrl(
      req.params.key,
      req.user!.sub,
      req.user!.role,
    );
    res.json({ url });
  }),
);

// POST /media/upload — legacy direct-buffer upload (used by server-side test helpers only)
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
      category: (req.query.category as "image" | "video" | "document") || "image",
      filename: (req.query.filename as string) || "upload",
      contentType:
        (req.query.content_type as string) ||
        req.headers["content-type"] ||
        "application/octet-stream",
      buffer,
    });
    res.json({ public_url });
  }),
);

export default router;
