import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { Forbidden, BadRequest } from "../../utils/errors";
import * as svc from "./users.service";
import * as docSvc from "./documents.service";
import {
  updateProfileSchema,
  athleteFieldsSchema,
  coachFieldsSchema,
  userIdParamSchema
} from "./users.schemas";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = Router();

// Public read: anyone (authenticated) can view a user profile.
router.get(
  "/:id",
  requireAuth,
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const u = await svc.getUserById(req.params.id);
    res.json({ user: u });
  })
);

router.put(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateProfile(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

router.put(
  "/me/athlete",
  requireAuth,
  validate(athleteFieldsSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateAthleteFields(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

router.put(
  "/me/coach",
  requireAuth,
  validate(coachFieldsSchema),
  asyncHandler(async (req, res) => {
    const u = await svc.updateCoachFields(req.user!.sub, req.body);
    res.json({ user: u });
  })
);

// ── Documents ────────────────────────────────────────────────
router.get(
  "/:id/documents",
  requireAuth,
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const docs = await docSvc.listDocuments(req.params.id);
    res.json({ items: docs });
  })
);

router.post(
  "/:id/documents",
  requireAuth,
  validate(userIdParamSchema, "params"),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (req.user!.sub !== req.params.id) throw Forbidden("Cannot upload documents for another user");
    if (!req.file) throw BadRequest("No file attached");
    const type = req.body.type as string;
    if (!type) throw BadRequest("Document type is required");
    const doc = await docSvc.uploadDocument({ userId: req.params.id, type, file: req.file });
    res.status(201).json({ document: doc });
  })
);

router.delete(
  "/:id/documents/:docId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await docSvc.deleteDocument(req.user!.sub, req.params.docId);
    res.json({ ok: true });
  })
);

export default router;
