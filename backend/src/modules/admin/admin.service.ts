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

export async function getUserDetail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound("User not found");
  return omitSensitive(user);
}

export async function updateUserProfile(
  actor: { id: string; role: Role },
  userId: string,
  patch: Record<string, unknown>
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw NotFound("User not found");

  const profileFields = ["full_name", "bio", "profile_photo_url", "cover_photo_url", "country", "state", "city", "dob", "gender", "preferred_language", "phone"];
  const data: Record<string, unknown> = {};
  for (const key of profileFields) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.full_name) data.full_name_lower = String(patch.full_name).toLowerCase();

  if (patch.athlete_data !== undefined) {
    const existing = (user.athlete_data as Record<string, unknown>) ?? {};
    data.athlete_data = { ...existing, ...(patch.athlete_data as Record<string, unknown>) };
  }
  if (patch.coach_data !== undefined) {
    const existing = (user.coach_data as Record<string, unknown>) ?? {};
    data.coach_data = { ...existing, ...(patch.coach_data as Record<string, unknown>) };
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  await audit({ actor, action: "user.profile_edited", target_type: "user", target_id: userId, details: { fields: Object.keys(data) } });
  return omitSensitive(updated);
}

export async function updateUserRole(
  actor: { id: string; role: Role },
  userId: string,
  newRole: Role
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw NotFound("User not found");
  if (userId === actor.id) throw BadRequest("Cannot change your own role");
  const updated = await prisma.user.update({ where: { id: userId }, data: { role: newRole as any } });
  await audit({ actor, action: "user.role_changed", target_type: "user", target_id: userId, details: { from: user.role, to: newRole } });
  return omitSensitive(updated);
}

export async function listAdminOpportunities(filter: {
  status?: string;
  type?: string;
  sport?: string;
  org_id?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.sport) where.sport = { contains: filter.sport, mode: "insensitive" };
  if (filter.org_id) where.org_id = filter.org_id;

  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: {
      _count: { select: { applications: true } },
      organization: { select: { org_name: true } }
    }
  });

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const items = page.map(({ _count, organization, ...opp }) => ({
    ...opp,
    application_count: _count.applications,
    org_name: organization?.org_name ?? null
  }));
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function adminUpdateOpportunity(
  actor: { id: string; role: Role },
  oppId: string,
  patch: Record<string, unknown>
) {
  const opp = await prisma.opportunity.findUnique({ where: { id: oppId } });
  if (!opp) throw NotFound("Opportunity not found");

  const allowed = [
    "title", "type", "sport", "description", "eligibility", "age_min", "age_max",
    "gender_eligibility", "experience_level_required", "country", "state", "city",
    "start_date", "end_date", "application_deadline", "entry_fee", "documents_required",
    "vacancies", "contact_email", "contact_phone", "status"
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.title) data.title_lower = String(patch.title).toLowerCase();

  const updated = await prisma.opportunity.update({ where: { id: oppId }, data });
  await audit({ actor, action: "opportunity.edited", target_type: "opportunity", target_id: oppId, details: { fields: Object.keys(data) } });
  return updated;
}

export async function adminDeleteOpportunity(actor: { id: string; role: Role }, oppId: string) {
  const opp = await prisma.opportunity.findUnique({ where: { id: oppId }, select: { id: true } });
  if (!opp) throw NotFound("Opportunity not found");
  await prisma.opportunity.delete({ where: { id: oppId } });
  await audit({ actor, action: "opportunity.deleted", target_type: "opportunity", target_id: oppId });
  return { ok: true };
}

export async function listAdminOrganizations(filter: { q?: string; limit: number; cursor?: string }) {
  const where: Record<string, unknown> = filter.q
    ? { org_name_lower: { contains: filter.q.toLowerCase() } }
    : {};

  const rows = await prisma.organization.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: { _count: { select: { opportunities: true } } }
  });

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const items = page.map(({ _count, ...org }) => ({ ...org, opportunity_count: _count.opportunities }));
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function adminUpdateOrganization(
  actor: { id: string; role: Role },
  orgId: string,
  patch: Record<string, unknown>
) {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw NotFound("Organization not found");

  const allowed = [
    "org_name", "org_type", "description", "logo_url", "cover_url", "sport_categories",
    "year_established", "country", "state", "city", "address", "website",
    "contact_name", "contact_email", "contact_phone", "social_links", "registration_doc_url",
    "subscription_plan"
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.org_name) data.org_name_lower = String(patch.org_name).toLowerCase();

  const updated = await prisma.organization.update({ where: { id: orgId }, data });
  await audit({ actor, action: "organization.edited", target_type: "organization", target_id: orgId, details: { fields: Object.keys(data) } });
  return updated;
}

export async function listAdminApplications(filter: {
  opportunity_id?: string;
  applicant_id?: string;
  status?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter.opportunity_id) where.opportunity_id = filter.opportunity_id;
  if (filter.applicant_id) where.applicant_user_id = filter.applicant_id;
  if (filter.status) where.status = filter.status;

  const rows = await prisma.application.findMany({
    where,
    orderBy: { applied_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: {
      opportunity: { select: { title: true, type: true } },
      applicant: { select: { full_name: true, email: true, role: true } }
    }
  });

  const hasMore = rows.length > filter.limit;
  const page = hasMore ? rows.slice(0, filter.limit) : rows;
  const items = page.map(({ opportunity, applicant, ...app }) => ({
    ...app,
    opportunity_title: opportunity?.title ?? null,
    opportunity_type: opportunity?.type ?? null,
    applicant_name: applicant?.full_name ?? null,
    applicant_email: applicant?.email ?? null,
    applicant_role: applicant?.role ?? null
  }));
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function adminTransitionApplication(
  actor: { id: string; role: Role },
  appId: string,
  status: string,
  reason?: string
) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw NotFound("Application not found");

  const validStatuses = ["applied", "shortlisted", "selected", "rejected", "withdrawn"];
  if (!validStatuses.includes(status)) throw BadRequest("Invalid status");

  const newHistory = [
    ...((app.history as object[]) ?? []),
    { status, at: new Date(), by: actor.id, admin_override: true, ...(reason ? { reason } : {}) }
  ];

  const updated = await prisma.application.update({
    where: { id: appId },
    data: {
      status: status as any,
      rejection_reason: status === "rejected" ? (reason ?? null) : (app.rejection_reason ?? null),
      history: newHistory
    }
  });

  await audit({ actor, action: "application.status_overridden", target_type: "application", target_id: appId, details: { from: app.status, to: status, reason } });
  return updated;
}
