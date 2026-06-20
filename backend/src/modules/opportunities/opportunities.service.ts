import { prisma } from "../../config/prisma";
import { eventBus } from "../../lib/EventBus";
import { Forbidden, NotFound, UnprocessableEntity } from "../../utils/errors";
import { logger } from "../../config/logger";
import { cacheGet, cacheSet, cacheDel } from "../../config/redis";
import type { Role } from "../../types/domain";

const OPP_VERSION_KEY = "opps:version";

async function getOppVersion(): Promise<string> {
  const v = await cacheGet(OPP_VERSION_KEY);
  return v ?? "0";
}

async function invalidateOppListCache(): Promise<void> {
  const v = await cacheGet(OPP_VERSION_KEY);
  const next = String((parseInt(v ?? "0", 10) + 1) % 1_000_000);
  await cacheSet(OPP_VERSION_KEY, next, 7 * 24 * 60 * 60);
}

async function oppListCacheKey(q: Record<string, unknown>): Promise<string> {
  const sorted = Object.keys(q).sort().reduce<Record<string, unknown>>((acc, k) => {
    acc[k] = q[k]; return acc;
  }, {});
  const version = await getOppVersion();
  return `opps:list:v${version}:${JSON.stringify(sorted)}`;
}

export async function createOpportunity(actorId: string, actorRole: Role, input: Record<string, unknown>) {
  const org = await prisma.organization.findUnique({ where: { id: input.org_id as string } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("You can only post opportunities for your own organization");

  const created = await prisma.opportunity.create({
    data: {
      org_id: org.id,
      posted_by_user_id: actorId,
      title: input.title as string,
      title_lower: String(input.title).toLowerCase(),
      type: input.type as any,
      sport: input.sport as string,
      description: input.description as string,
      eligibility: input.eligibility as string | undefined,
      age_min: input.age_min as number,
      age_max: input.age_max as number,
      gender_eligibility: (input.gender_eligibility as string) ?? "all",
      experience_level_required: (input.experience_level_required as string) ?? "any",
      country: (input.country as string) ?? org.country ?? "",
      state: (input.state as string) ?? org.state ?? "",
      city: (input.city as string) ?? org.city ?? "",
      start_date: (input.start_date as string) || (input.application_deadline as string),
      end_date: (input.end_date as string) || (input.application_deadline as string),
      application_deadline: input.application_deadline as string,
      entry_fee: input.entry_fee as number | undefined,
      documents_required: (input.documents_required as string[]) ?? [],
      vacancies: input.vacancies as number | undefined,
      contact_email: (input.contact_email as string) ?? org.contact_email ?? undefined,
      contact_phone: (input.contact_phone as string) ?? org.contact_phone ?? undefined
    }
  });
  await invalidateOppListCache();
  return created;
}

export async function updateOpportunity(id: string, actorId: string, actorRole: Role, patch: Record<string, unknown>) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { organization: { select: { owner_user_id: true } } }
  });
  if (!opp) throw NotFound("Opportunity not found");

  // Only org owner or admin may update
  if (opp.organization.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the organization owner or an admin can update this opportunity");

  // Cannot update a closed or filled opportunity
  if (opp.status === "closed" || opp.status === "filled")
    throw UnprocessableEntity(`Cannot update a ${opp.status} opportunity`);

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

  const updated = await prisma.opportunity.update({ where: { id }, data });
  await invalidateOppListCache();
  return updated;
}

export async function linkScoringTournament(id: string, actorId: string, actorRole: Role, scoringTournamentId: string | null) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { organization: { select: { owner_user_id: true } } }
  });
  if (!opp) throw NotFound("Opportunity not found");
  if (opp.organization.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the organization owner or an admin can link a scoring tournament");

  const updated = await prisma.opportunity.update({
    where: { id },
    data: { scoring_tournament_id: scoringTournamentId }
  });
  await invalidateOppListCache();
  return updated;
}

export async function getOpportunity(id: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: {
      _count: { select: { applications: true } },
      organization: { select: { org_name: true } }
    }
  });
  if (!opp) throw NotFound("Opportunity not found");

  const { _count, organization, ...rest } = opp;
  const realAppCount = _count.applications;
  const realFilled = await prisma.application.count({
    where: { opportunity_id: id, status: "selected" }
  });

  const base = {
    ...rest,
    org_name: organization?.org_name,
    application_count: realAppCount,
    vacancies_filled: realFilled
  };

  if (base.status === "open" && new Date(base.application_deadline) < new Date()) {
    await prisma.opportunity.update({ where: { id }, data: { status: "closed" } });
    return { ...base, status: "closed" };
  }
  return base;
}

export async function deleteOpportunity(id: string, actorId: string, actorRole: Role) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { organization: { select: { owner_user_id: true } } }
  });
  if (!opp) throw NotFound("Opportunity not found");

  // Only org owner or admin may delete
  if (opp.organization.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the organization owner or an admin can delete this opportunity");

  // Collect pending/shortlisted apps for notification before deleting
  const appsToWithdraw = await prisma.application.findMany({
    where: { opportunity_id: id, status: { in: ["pending", "shortlisted"] } },
    select: { id: true, applicant_user_id: true }
  });

  // Transition pending/shortlisted to withdrawn, then delete all apps, then delete opp
  await prisma.$transaction([
    prisma.application.updateMany({
      where: { opportunity_id: id, status: { in: ["pending", "shortlisted"] } },
      data: { status: "withdrawn" }
    }),
    prisma.application.deleteMany({ where: { opportunity_id: id } }),
    prisma.opportunity.delete({ where: { id } })
  ]);

  await invalidateOppListCache();

  // Emit notification events for each withdrawn application
  for (const app of appsToWithdraw) {
    eventBus.emit("application.status_changed", {
      applicationId: app.id,
      opportunityTitle: opp.title,
      athleteId: app.applicant_user_id,
      clubId: opp.org_id,
      fromStatus: "pending",
      toStatus: "withdrawn",
      actorId
    });
  }

  return { ok: true };
}

export async function listOpportunities(q: {
  sport?: string;
  type?: string;
  sort?: "newest" | "deadline";
  limit: number;
  cursor?: string;
  // extended filters
  status?: string;
  org_id?: string;
  country?: string;
  city?: string;
  q?: string;
  verified_org?: boolean;
}) {
  const cacheKey = await oppListCacheKey(q as Record<string, unknown>);
  const cached = await cacheGet(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  const where: Record<string, unknown> = {
    status: q.status ?? "open"
  };
  if (q.sport) where.sport = q.sport;
  if (q.type) where.type = q.type;
  if (q.country) where.country = { contains: q.country, mode: "insensitive" };
  if (q.city) where.city = { contains: q.city, mode: "insensitive" };
  if (q.org_id) where.org_id = q.org_id;
  if (q.q) where.title_lower = { contains: q.q.toLowerCase() };
  if (q.verified_org) where.organization = { is_verified: true };

  const orderBy =
    q.sort === "deadline"
      ? [{ application_deadline: "asc" as const }, { id: "asc" as const }]
      : [{ created_at: "desc" as const }, { id: "desc" as const }];

  const [rows, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy,
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      include: {
        _count: { select: { applications: true } },
        organization: { select: { org_name: true } }
      }
    }),
    prisma.opportunity.count({ where })
  ]);

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const data = page.map(({ _count, organization, ...opp }) => ({
    ...opp,
    org_name: organization?.org_name,
    application_count: _count.applications
  }));
  const result = { data, nextCursor: hasMore ? data[data.length - 1].id : null, total };
  await cacheSet(cacheKey, JSON.stringify(result), 60);
  return result;
}

export async function bumpApplicationCount(id: string, delta: number) {
  await prisma.opportunity.update({
    where: { id },
    data: { application_count: { increment: delta } }
  });
}

export async function markFilled(id: string) {
  await prisma.opportunity.update({
    where: { id },
    data: { vacancies_filled: { increment: 1 } }
  });
}

export async function checkAndCloseExpiredOpportunities(): Promise<void> {
  try {
    const result = await prisma.$executeRaw`
      UPDATE "Opportunity"
      SET status = 'closed', updated_at = NOW()
      WHERE status = 'open'
        AND application_deadline < NOW()::date
    `;
    if (result > 0) {
      logger.info({ count: result }, "auto-closed expired opportunities");
      await invalidateOppListCache();
    }
  } catch (err) {
    logger.error({ err }, "failed to auto-close expired opportunities");
  }
}
