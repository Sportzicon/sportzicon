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

export default router;
