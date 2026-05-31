import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";
import type { Role } from "../../types/domain";

export async function createOpportunity(actorId: string, actorRole: Role, input: Record<string, unknown>) {
  const org = await prisma.organization.findUnique({ where: { id: input.org_id as string } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("You can only post opportunities for your own organization");

  return prisma.opportunity.create({
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
      start_date: input.start_date as string,
      end_date: input.end_date as string,
      application_deadline: input.application_deadline as string,
      entry_fee: input.entry_fee as number | undefined,
      documents_required: (input.documents_required as string[]) ?? [],
      vacancies: input.vacancies as number | undefined,
      contact_email: (input.contact_email as string) ?? org.contact_email ?? undefined,
      contact_phone: (input.contact_phone as string) ?? org.contact_phone ?? undefined
    }
  });
}

export async function updateOpportunity(id: string, actorId: string, actorRole: Role, patch: Record<string, unknown>) {
  const opp = await prisma.opportunity.findUnique({ where: { id } });
  if (!opp) throw NotFound("Opportunity not found");
  if (opp.posted_by_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the poster or an admin can update this opportunity");

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

  return prisma.opportunity.update({ where: { id }, data });
}

export async function getOpportunity(id: string) {
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } }
  });
  if (!opp) throw NotFound("Opportunity not found");

  const { _count, ...rest } = opp;
  const realAppCount = _count.applications;
  const realFilled = await prisma.application.count({
    where: { opportunity_id: id, status: "selected" }
  });

  const base = { ...rest, application_count: realAppCount, vacancies_filled: realFilled };

  if (base.status === "open" && new Date(base.application_deadline) < new Date()) {
    await prisma.opportunity.update({ where: { id }, data: { status: "closed" } });
    return { ...base, status: "closed" };
  }
  return base;
}

export async function deleteOpportunity(id: string, actorId: string, actorRole: Role) {
  const opp = await prisma.opportunity.findUnique({ where: { id }, select: { posted_by_user_id: true } });
  if (!opp) throw NotFound("Opportunity not found");
  if (opp.posted_by_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the poster or an admin can delete this opportunity");
  await prisma.opportunity.delete({ where: { id } });
  return { ok: true };
}

export async function listOpportunities(q: {
  sport?: string;
  type?: string;
  country?: string;
  city?: string;
  status?: string;
  org_id?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (q.status) where.status = q.status;
  if (q.sport) where.sport = q.sport;
  if (q.type) where.type = q.type;
  if (q.country) where.country = q.country;
  if (q.city) where.city = q.city;
  if (q.org_id) where.org_id = q.org_id;

  const rows = await prisma.opportunity.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { _count: { select: { applications: true } } }
  });

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const items = page.map(({ _count, ...opp }) => ({
    ...opp,
    application_count: _count.applications
  }));
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
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
