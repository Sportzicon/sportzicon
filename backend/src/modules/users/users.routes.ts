import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/async";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import { linkPreviewLimiter } from "../../middleware/rateLimit";
import { Forbidden, BadRequest } from "../../utils/errors";
import * as svc from "./users.service";
import * as docSvc from "./documents.service";
import * as tourSvc from "./tournaments.service";
import {
  updateProfileSchema,
  athleteFieldsSchema,
  coachFieldsSchema,
  userIdParamSchema,
  linkPreviewRequestSchema,
  uploadDocumentBodySchema,
  documentParamSchema,
  tournamentSchema,
  tournamentParamSchema
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

router.post(
  "/me/scorecard-link-preview",
  requireAuth,
  linkPreviewLimiter,
  validate(linkPreviewRequestSchema),
  asyncHandler(async (req, res) => {
    const preview = await svc.getScorecardLinkPreview(req.body.url);
    res.json(preview);
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
  validate(uploadDocumentBodySchema),
  asyncHandler(async (req, res) => {
    if (req.user!.sub !== req.params.id) throw Forbidden("Cannot upload documents for another user");
    if (!req.file) throw BadRequest("No file attached");
    const doc = await docSvc.uploadDocument({ userId: req.params.id, type: req.body.type, file: req.file });
    res.status(201).json({ document: doc });
  })
);

router.delete(
  "/:id/documents/:docId",
  requireAuth,
  validate(documentParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await docSvc.deleteDocument(req.user!.sub, req.params.docId, req.user!.role);
    res.json({ ok: true });
  })
);

// ── Tournaments ──────────────────────────────────────────────
router.get(
  "/:id/tournaments",
  requireAuth,
  validate(userIdParamSchema, "params"),
  asyncHandler(async (req, res) => {
    const items = await tourSvc.listTournaments(req.params.id);
    res.json({ items });
  })
);

router.post(
  "/:id/tournaments",
  requireAuth,
  validate(userIdParamSchema, "params"),
  validate(tournamentSchema),
  asyncHandler(async (req, res) => {
    if (req.user!.sub !== req.params.id) throw Forbidden("Cannot add tournaments for another user");
    const t = await tourSvc.createTournament(req.params.id, req.body);
    res.status(201).json({ tournament: t });
  })
);

router.put(
  "/:id/tournaments/:tournamentId",
  requireAuth,
  validate(tournamentParamSchema, "params"),
  validate(tournamentSchema),
  asyncHandler(async (req, res) => {
    const t = await tourSvc.updateTournament(req.user!.sub, req.params.tournamentId, req.user!.role, req.body);
    res.json({ tournament: t });
  })
);

router.delete(
  "/:id/tournaments/:tournamentId",
  requireAuth,
  validate(tournamentParamSchema, "params"),
  asyncHandler(async (req, res) => {
    await tourSvc.deleteTournament(req.user!.sub, req.params.tournamentId, req.user!.role);
    res.json({ ok: true });
  })
);

export default router;
