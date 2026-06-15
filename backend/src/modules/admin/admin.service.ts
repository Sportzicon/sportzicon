import { prisma } from "../../config/prisma";
import { BadRequest, Conflict, NotFound } from "../../utils/errors";
import { omitSensitive } from "../../utils/user";
import { hashPassword } from "../auth/tokens";
import { validateAthleteSportProfile } from "../users/sportProfile";
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

export async function listUsers(filter: {
  status?: AccountStatus;
  role?: Role;
  q?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter.status) where.status = filter.status;
  if (filter.role) where.role = filter.role;
  if (filter.q) {
    const q = filter.q.toLowerCase();
    where.OR = [
      { full_name_lower: { contains: q } },
      { email_lower: { contains: q } }
    ];
  }

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

export async function banUser(actor: { id: string; role: Role }, userId: string, reason: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw NotFound("User not found");
  if (userId === actor.id) throw BadRequest("Cannot ban yourself");
  if (user.role === "admin") throw BadRequest("Cannot ban another admin");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: "suspended" as any,
        is_banned: true,
        banned_reason: reason,
        banned_at: new Date()
      }
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: userId } })
  ]);

  await audit({
    actor,
    action: "user.banned",
    target_type: "user",
    target_id: userId,
    details: { reason }
  });
  return { ok: true };
}

export async function unbanUser(actor: { id: string; role: Role }, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, is_banned: true } });
  if (!user) throw NotFound("User not found");

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "active" as any,
      is_banned: false,
      banned_reason: null,
      banned_at: null
    }
  });

  await audit({ actor, action: "user.unbanned", target_type: "user", target_id: userId });
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

export async function listReports(filter: {
  status?: string;
  type?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter.status && filter.status !== "all") where.status = filter.status;
  if (filter.type) where.target_type = filter.type;

  const items = await prisma.report.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: { reporter: { select: { full_name: true, email: true } } }
  });

  const hasMore = items.length > filter.limit;
  const page = hasMore ? items.slice(0, filter.limit) : items;
  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].id : null
  };
}

export async function resolveReport(
  actor: { id: string; role: Role },
  reportId: string,
  action: "warned" | "banned" | "dismissed",
  notes?: string
) {
  const exists = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } });
  if (!exists) throw NotFound("Report not found");
  await prisma.report.update({
    where: { id: reportId },
    data: { status: action === "dismissed" ? "dismissed" : "actioned", resolved_by: actor.id, resolved_at: new Date(), notes }
  });
  await audit({ actor, action: `report.${action}`, target_type: "report", target_id: reportId, details: { notes } });
  return { ok: true };
}

export async function listAuditLogs(filter: {
  limit: number;
  cursor?: string;
  actor_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}) {
  const where: Record<string, unknown> = {};
  if (filter.actor_id) where.actor_id = filter.actor_id;
  if (filter.action) where.action = { contains: filter.action };
  if (filter.date_from || filter.date_to) {
    where.created_at = {
      ...(filter.date_from ? { gte: new Date(filter.date_from) } : {}),
      ...(filter.date_to ? { lte: new Date(filter.date_to + "T23:59:59Z") } : {})
    };
  }

  const items = await prisma.auditLog.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: filter.limit + 1,
    ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    include: { actor: { select: { full_name: true, email: true } } }
  });

  const hasMore = items.length > filter.limit;
  const page = hasMore ? items.slice(0, filter.limit) : items;
  return {
    items: page,
    next_cursor: hasMore ? page[page.length - 1].id : null
  };
}

export async function analytics() {
  const [users, orgs, opps, applications, open_reports, pending_verifs] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.opportunity.count(),
    prisma.application.count(),
    prisma.report.count({ where: { status: "open" } }),
    prisma.verification.count({ where: { status: "pending" } })
  ]);
  return { users, organizations: orgs, opportunities: opps, applications, open_reports, pending_verifications: pending_verifs };
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
    const merged = { ...existing, ...(patch.athlete_data as Record<string, unknown>) };
    const violations = validateAthleteSportProfile(merged);
    if (violations.length) throw BadRequest(violations.join(" "));
    data.athlete_data = merged;
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

export async function adminDeletePost(actor: { id: string; role: Role }, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) throw NotFound("Post not found");
  await prisma.post.delete({ where: { id: postId } });
  await audit({ actor, action: "post.deleted_by_admin", target_type: "post", target_id: postId });
  return { ok: true };
}

export async function adminDeleteReel(actor: { id: string; role: Role }, reelId: string) {
  const reel = await prisma.reel.findUnique({ where: { id: reelId }, select: { id: true, video_url: true } });
  if (!reel) throw NotFound("Reel not found");
  await prisma.reel.delete({ where: { id: reelId } });
  await audit({ actor, action: "reel.deleted_by_admin", target_type: "reel", target_id: reelId, details: { video_url: reel.video_url } });
  return { ok: true };
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

export async function adminCreateUser(
  actor: { id: string; role: Role },
  input: {
    email: string;
    password: string;
    full_name: string;
    role: Role;
    phone?: string;
    country?: string;
    state?: string;
    city?: string;
  }
) {
  const emailLower = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email_lower: emailLower }, select: { id: true } });
  if (existing) throw Conflict("Email already in use");
  const password_hash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email.trim(),
      email_lower: emailLower,
      email_verified: true,
      phone: input.phone ?? null,
      password_hash,
      full_name: input.full_name,
      full_name_lower: input.full_name.toLowerCase(),
      role: input.role as any,
      status: "active",
      country: input.country,
      state: input.state,
      city: input.city
    }
  });
  await audit({ actor, action: "user.created_by_admin", target_type: "user", target_id: user.id, details: { role: input.role } });
  return omitSensitive(user);
}

export async function adminCreateOrganization(
  actor: { id: string; role: Role },
  input: {
    org_name: string;
    org_type: string;
    owner_user_id?: string;
    description?: string;
    country?: string;
    state?: string;
    city?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    website?: string;
    sport_categories?: string[];
    subscription_plan?: string;
  }
) {
  const ownerId = input.owner_user_id ?? actor.id;
  const ownerExists = await prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } });
  if (!ownerExists) throw NotFound("Owner user not found");
  const org = await prisma.organization.create({
    data: {
      owner_user_id: ownerId,
      org_name: input.org_name,
      org_name_lower: input.org_name.toLowerCase(),
      org_type: input.org_type,
      description: input.description,
      country: input.country,
      state: input.state,
      city: input.city,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      website: input.website,
      sport_categories: input.sport_categories ?? [],
      subscription_plan: input.subscription_plan ?? "free"
    }
  });
  await audit({ actor, action: "organization.created_by_admin", target_type: "organization", target_id: org.id, details: { org_name: org.org_name } });
  return org;
}

export async function adminCreateOpportunity(
  actor: { id: string; role: Role },
  input: {
    org_id: string;
    title: string;
    type: string;
    sport: string;
    description: string;
    country: string;
    state?: string;
    city: string;
    start_date: string;
    end_date: string;
    application_deadline: string;
    age_min?: number;
    age_max?: number;
    gender_eligibility?: string;
    experience_level_required?: string;
    eligibility?: string;
    entry_fee?: number;
    vacancies?: number;
    contact_email?: string;
    contact_phone?: string;
  }
) {
  const org = await prisma.organization.findUnique({ where: { id: input.org_id }, select: { id: true } });
  if (!org) throw NotFound("Organization not found");
  const opp = await prisma.opportunity.create({
    data: {
      org_id: input.org_id,
      posted_by_user_id: actor.id,
      title: input.title,
      title_lower: input.title.toLowerCase(),
      type: input.type as any,
      sport: input.sport,
      description: input.description,
      country: input.country,
      state: input.state ?? "",
      city: input.city,
      start_date: input.start_date,
      end_date: input.end_date,
      application_deadline: input.application_deadline,
      age_min: input.age_min ?? 0,
      age_max: input.age_max ?? 99,
      gender_eligibility: input.gender_eligibility ?? "all",
      experience_level_required: input.experience_level_required ?? "any",
      eligibility: input.eligibility,
      entry_fee: input.entry_fee,
      vacancies: input.vacancies,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      status: "open"
    }
  });
  await audit({ actor, action: "opportunity.created_by_admin", target_type: "opportunity", target_id: opp.id, details: { title: opp.title, type: opp.type } });
  return opp;
}

export async function adminTransitionApplication(
  actor: { id: string; role: Role },
  appId: string,
  status: string,
  reason?: string
) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw NotFound("Application not found");

  const validStatuses = ["pending", "shortlisted", "selected", "rejected", "withdrawn"];
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
