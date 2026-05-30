import { prisma } from "../../config/prisma";
import { BadRequest, NotFound } from "../../utils/errors";
import { omitSensitive } from "../../utils/user";
import type { AccountStatus, Role, ReportStatus } from "../../types/domain";

export async function audit(input: {
  actor: { id: string; role: Role };
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, unknown>;
  ip?: string;
}) {
  return prisma.auditLog.create({
    data: {
      actor_id: input.actor.id,
      actor_role: input.actor.role as any,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      details: input.details as object | undefined,
      ip: input.ip
    }
  });
}

export async function listUsers(filter: { status?: AccountStatus; role?: Role; limit: number; cursor?: string }) {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.role) where.role = filter.role;

  const items = await prisma.user.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {})
  });

  const hasMore = items.length > filter.limit;
  const page = hasMore ? items.slice(0, filter.limit) : items;
  return {
    items: page.map(omitSensitive),
    next_cursor: hasMore ? page[page.length - 1].id : null
  };
}

export async function setUserStatus(actor: { id: string; role: Role }, userId: string, status: AccountStatus, reason?: string) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw NotFound("User not found");
  await prisma.user.update({ where: { id: userId }, data: { status: status as any } });
  await audit({ actor, action: `user.${status}`, target_type: "user", target_id: userId, details: { reason } });
  return { ok: true };
}

export async function setUserBadges(actor: { id: string; role: Role }, userId: string, badges: string[]) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw NotFound("User not found");
  await prisma.user.update({
    where: { id: userId },
    data: {
      verification_badges: badges,
      verification_status: badges.length > 0 ? "approved" : "unverified"
    }
  });
  await audit({ actor, action: "user.badges", target_type: "user", target_id: userId, details: { badges } });
  return { ok: true };
}

export async function listReports(status: ReportStatus | "all", limit: number) {
  const where: Record<string, unknown> = {};
  if (status !== "all") where.status = status;
  return prisma.report.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit
  });
}

export async function resolveReport(
  actor: { id: string; role: Role },
  reportId: string,
  status: "actioned" | "dismissed",
  notes?: string
) {
  const exists = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!exists) throw NotFound("Report not found");
  await prisma.report.update({
    where: { id: reportId },
    data: { status, resolved_by: actor.id, resolved_at: new Date(), notes }
  });
  await audit({ actor, action: `report.${status}`, target_type: "report", target_id: reportId, details: { notes } });
  return { ok: true };
}

export async function listAuditLogs(limit: number, cursor?: string) {
  const items = await prisma.auditLog.findMany({
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].id : null
  };
}

export async function analytics() {
  const [users, orgs, opps, applications, open_reports] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.opportunity.count(),
    prisma.application.count(),
    prisma.report.count({ where: { status: "open" } })
  ]);
  return { users, organizations: orgs, opportunities: opps, applications, open_reports };
}

export async function createReport(reporterId: string, input: Record<string, unknown>) {
  if (!input.reason || !input.target_id || !input.target_type) throw BadRequest("Missing required fields");
  return prisma.report.create({
    data: {
      reporter_id: reporterId,
      target_type: input.target_type as string,
      target_id: input.target_id as string,
      reason: input.reason as string
    }
  });
}

export async function deleteUser(actor: { id: string; role: Role }, userId: string) {
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw NotFound("User not found");
  await prisma.user.delete({ where: { id: userId } });
  await audit({ actor, action: "user.deleted", target_type: "user", target_id: userId });
  return { ok: true };
}
