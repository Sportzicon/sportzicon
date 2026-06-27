import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";
import { formatOrg } from "../../utils/org";
import { cacheGet, cacheSet, cacheDel } from "../../config/redis";
import type { Role } from "../../types/domain";

export async function createOrganization(ownerId: string, ownerRole: Role, input: Record<string, unknown>) {
  if (ownerRole !== "club" && ownerRole !== "organizer" && ownerRole !== "admin")
    throw Forbidden("Only club, organizer, or admin accounts can create an organization");

  const org = await prisma.organization.create({
    data: {
      owner_user_id: ownerId,
      org_name: input.org_name as string,
      org_name_lower: String(input.org_name).toLowerCase(),
      org_type: input.org_type as string,
      verification_status: "pending",
      description: input.description as string | undefined,
      logo_url: input.logo_url as string | undefined,
      cover_url: input.cover_url as string | undefined,
      sport_categories: (input.sport_categories as string[]) ?? [],
      year_established: input.year_established as number | undefined,
      country: input.country as string | undefined,
      state: input.state as string | undefined,
      city: input.city as string | undefined,
      address: input.address as string | undefined,
      website: input.website as string | undefined,
      contact_name: input.contact_name as string | undefined,
      contact_email: input.contact_email as string | undefined,
      contact_phone: input.contact_phone as string | undefined,
      social_links: input.social_links as object | undefined,
      registration_doc_url: input.registration_doc_url as string | undefined
    }
  });
  return formatOrg(org);
}

export async function updateOrganization(orgId: string, actorId: string, actorRole: Role, patch: Record<string, unknown>) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { owner_user_id: true } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can update this organization");

  const allowed = [
    "org_name", "org_type", "description", "logo_url", "cover_url", "sport_categories",
    "year_established", "country", "state", "city", "address", "website",
    "contact_name", "contact_email", "contact_phone", "social_links", "registration_doc_url"
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }
  if (patch.org_name) data.org_name_lower = String(patch.org_name).toLowerCase();

  const updated = await prisma.organization.update({ where: { id: orgId }, data });
  await cacheDel(`org:${orgId}`);
  return formatOrg(updated);
}

export async function getOrganization(orgId: string) {
  const key = `org:${orgId}`;
  const cached = await cacheGet(key);
  if (cached !== null) return JSON.parse(cached);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true, owner_user_id: true, org_name: true, org_name_lower: true,
      org_type: true, description: true, logo_url: true, cover_url: true,
      sport_categories: true, year_established: true,
      country: true, state: true, city: true, address: true,
      website: true, contact_name: true, contact_email: true, contact_phone: true,
      social_links: true, registration_doc_url: true,
      verification_status: true, verification_badges: true,
      subscription_plan: true, created_at: true, updated_at: true
    }
  });
  if (!org) throw NotFound("Organization not found");
  const result = formatOrg(org as any);
  await cacheSet(key, JSON.stringify(result), 300);
  return result;
}

export async function listAllOrganizations(q: string, limit: number) {
  const where = q
    ? { org_name_lower: { contains: q.toLowerCase() } }
    : {};
  const orgs = await prisma.organization.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit
  });
  return orgs.map(formatOrg);
}

export async function listOrganizationsForOwner(ownerId: string) {
  const orgs = await prisma.organization.findMany({
    where: { owner_user_id: ownerId },
    orderBy: { created_at: "desc" }
  });
  return orgs.map(formatOrg);
}

export async function addOrgDocument(orgId: string, actorId: string, actorRole: string, key: string, name: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { owner_user_id: true } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can upload documents");

  return prisma.orgDocument.create({ data: { org_id: orgId, key, name } });
}

export async function listOrgDocuments(orgId: string, actorId: string, actorRole: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { owner_user_id: true } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can view documents");

  return prisma.orgDocument.findMany({ where: { org_id: orgId }, orderBy: { uploaded_at: "desc" } });
}

export async function deleteOrganization(orgId: string, actorId: string, isAdmin: boolean) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { owner_user_id: true } });
  if (!org) throw NotFound("Organization not found");
  if (org.owner_user_id !== actorId && !isAdmin)
    throw Forbidden("Only the org owner or an admin can delete this organization");
  await prisma.organization.delete({ where: { id: orgId } });
  await cacheDel(`org:${orgId}`);
  return { ok: true };
}
