import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as svc from "./admin.service";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const r = await svc.listUsers({
      status: req.query.status as any,
      role: req.query.role as any,
      limit: Math.min(Number(req.query.limit) || 50, 200),
      cursor: req.query.cursor as string | undefined
    });
    res.json(r);
  })
);

router.patch(
  "/users/:id/status",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(
    z.object({ status: z.enum(["active", "suspended", "pending"]), reason: z.string().max(500).optional() })
  ),
  asyncHandler(async (req, res) => {
    const r = await svc.setUserStatus(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json(r);
  })
);

router.patch(
  "/users/:id/badges",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ badges: z.array(z.string()).max(20) })),
  asyncHandler(async (req, res) => {
    const r = await svc.setUserBadges({ id: req.user!.sub, role: req.user!.role }, req.params.id, req.body.badges);
    res.json(r);
  })
);

router.delete(
  "/users/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.deleteUser({ id: req.user!.sub, role: req.user!.role }, req.params.id);
    res.json(r);
  })
);

router.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const status = (req.query.status as any) ?? "open";
    const items = await svc.listReports(status, Math.min(Number(req.query.limit) || 100, 200));
    res.json({ items });
  })
);

router.patch(
  "/reports/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ status: z.enum(["actioned", "dismissed"]), notes: z.string().max(2000).optional() })),
  asyncHandler(async (req, res) => {
    const r = await svc.resolveReport(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body.status,
      req.body.notes
    );
    res.json(r);
  })
);

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const r = await svc.listAuditLogs(
      Math.min(Number(req.query.limit) || 100, 500),
      req.query.cursor as string | undefined
    );
    res.json(r);
  })
);

router.get(
  "/analytics",
  asyncHandler(async (_req, res) => {
    const r = await svc.analytics();
    res.json(r);
  })
);

// ─── User detail & profile editing ──────────────────────────────────────────

router.get(
  "/users/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.getUserDetail(req.params.id);
    res.json(r);
  })
);

router.patch(
  "/users/:id/profile",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(
    z.object({
      full_name: z.string().min(2).max(120).optional(),
      bio: z.string().max(500).optional(),
      profile_photo_url: z.string().url().nullable().optional(),
      cover_photo_url: z.string().url().nullable().optional(),
      country: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      city: z.string().max(80).optional(),
      dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
      preferred_language: z.string().max(20).optional(),
      phone: z.string().min(7).max(20).optional(),
      athlete_data: z.record(z.string(), z.unknown()).optional(),
      coach_data: z.record(z.string(), z.unknown()).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const r = await svc.updateUserProfile(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body
    );
    res.json(r);
  })
);

router.patch(
  "/users/:id/role",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(z.object({ role: z.enum(["athlete", "club", "scout", "organizer", "admin", "scorer"]) })),
  asyncHandler(async (req, res) => {
    const r = await svc.updateUserRole(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body.role
    );
    res.json(r);
  })
);

// ─── Opportunity management ──────────────────────────────────────────────────

router.get(
  "/opportunities",
  asyncHandler(async (req, res) => {
    const r = await svc.listAdminOpportunities({
      status: req.query.status as string | undefined,
      type: req.query.type as string | undefined,
      sport: req.query.sport as string | undefined,
      org_id: req.query.org_id as string | undefined,
      limit: Math.min(Number(req.query.limit) || 50, 200),
      cursor: req.query.cursor as string | undefined
    });
    res.json(r);
  })
);

router.patch(
  "/opportunities/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(
    z.object({
      title: z.string().min(3).max(140).optional(),
      type: z.enum(["trial", "recruitment", "scholarship", "tournament", "coaching_job"]).optional(),
      sport: z.string().min(2).max(60).optional(),
      description: z.string().min(10).max(5000).optional(),
      eligibility: z.string().max(2000).optional(),
      age_min: z.number().int().min(0).max(120).optional(),
      age_max: z.number().int().min(0).max(120).optional(),
      gender_eligibility: z.enum(["all", "male", "female", "other"]).optional(),
      experience_level_required: z.enum(["any", "beginner", "amateur", "semi_pro", "professional"]).optional(),
      country: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      city: z.string().max(80).optional(),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
      application_deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
      entry_fee: z.number().nonnegative().optional(),
      documents_required: z.array(z.string().max(120)).max(20).optional(),
      vacancies: z.number().int().positive().optional(),
      contact_email: z.string().email().optional(),
      contact_phone: z.string().max(20).optional(),
      status: z.enum(["open", "closed", "filled"]).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const r = await svc.adminUpdateOpportunity(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body
    );
    res.json(r);
  })
);

router.delete(
  "/opportunities/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  asyncHandler(async (req, res) => {
    const r = await svc.adminDeleteOpportunity({ id: req.user!.sub, role: req.user!.role }, req.params.id);
    res.json(r);
  })
);

// ─── Organization management ─────────────────────────────────────────────────

router.get(
  "/organizations",
  asyncHandler(async (req, res) => {
    const r = await svc.listAdminOrganizations({
      q: req.query.q as string | undefined,
      limit: Math.min(Number(req.query.limit) || 50, 200),
      cursor: req.query.cursor as string | undefined
    });
    res.json(r);
  })
);

router.patch(
  "/organizations/:id",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(
    z.object({
      org_name: z.string().min(2).max(120).optional(),
      org_type: z.string().max(80).optional(),
      description: z.string().max(2000).optional(),
      logo_url: z.string().url().nullable().optional(),
      cover_url: z.string().url().nullable().optional(),
      sport_categories: z.array(z.string()).max(20).optional(),
      year_established: z.number().int().min(1800).max(2100).optional(),
      country: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      city: z.string().max(80).optional(),
      address: z.string().max(300).optional(),
      website: z.string().url().nullable().optional(),
      contact_name: z.string().max(120).optional(),
      contact_email: z.string().email().optional(),
      contact_phone: z.string().max(20).optional(),
      subscription_plan: z.string().max(40).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const r = await svc.adminUpdateOrganization(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body
    );
    res.json(r);
  })
);

// ─── Application management ──────────────────────────────────────────────────

router.get(
  "/applications",
  asyncHandler(async (req, res) => {
    const r = await svc.listAdminApplications({
      opportunity_id: req.query.opportunity_id as string | undefined,
      applicant_id: req.query.applicant_id as string | undefined,
      status: req.query.status as string | undefined,
      limit: Math.min(Number(req.query.limit) || 50, 200),
      cursor: req.query.cursor as string | undefined
    });
    res.json(r);
  })
);

router.patch(
  "/applications/:id/status",
  validate(z.object({ id: z.string().min(8) }), "params"),
  validate(
    z.object({
      status: z.enum(["applied", "shortlisted", "selected", "rejected", "withdrawn"]),
      reason: z.string().max(1000).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const r = await svc.adminTransitionApplication(
      { id: req.user!.sub, role: req.user!.role },
      req.params.id,
      req.body.status,
      req.body.reason
    );
    res.json(r);
  })
);

export default router;
