import { db, Collections } from "../../config/firestore";
import { Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import type { OrganizationDoc, Role } from "../../types/domain";

export async function createOrganization(ownerId: string, ownerRole: Role, input: any) {
  if (ownerRole !== "club" && ownerRole !== "organizer")
    throw Forbidden("Only club or organizer accounts can create an organization");
  const id = newId();
  const org: OrganizationDoc = {
    id,
    owner_user_id: ownerId,
    org_name: input.org_name,
    org_name_lower: String(input.org_name).toLowerCase(),
    org_type: input.org_type,
    description: input.description,
    logo_url: input.logo_url,
    cover_url: input.cover_url,
    sport_categories: input.sport_categories ?? [],
    year_established: input.year_established,
    country: input.country,
    state: input.state,
    city: input.city,
    address: input.address,
    website: input.website,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    social_links: input.social_links,
    registration_doc_url: input.registration_doc_url,
    verification: { status: "unverified", badges: [] },
    subscription_plan: "free",
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.organizations).doc(id).set(org);
  return org;
}

export async function updateOrganization(orgId: string, actorId: string, actorRole: Role, patch: any) {
  const ref = db.collection(Collections.organizations).doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Organization not found");
  const org = snap.data() as OrganizationDoc;
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the org owner or an admin can update this organization");

  const update: any = { updated_at: now() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) update[k] = v;
  }
  if (patch.org_name) update.org_name_lower = String(patch.org_name).toLowerCase();
  await ref.update(update);
  return { ...(org as any), ...update } as OrganizationDoc;
}

export async function getOrganization(orgId: string) {
  const snap = await db.collection(Collections.organizations).doc(orgId).get();
  if (!snap.exists) throw NotFound("Organization not found");
  return snap.data() as OrganizationDoc;
}

export async function listOrganizationsForOwner(ownerId: string) {
  const snap = await db
    .collection(Collections.organizations)
    .where("owner_user_id", "==", ownerId)
    .get();
  const docs = snap.docs.map((d) => d.data() as OrganizationDoc);
  return docs.sort((a, b) => b.created_at - a.created_at);
}

export async function deleteOrganization(orgId: string, actorId: string, isAdmin: boolean) {
  const ref = db.collection(Collections.organizations).doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Organization not found");
  const org = snap.data() as OrganizationDoc;
  if (org.owner_user_id !== actorId && !isAdmin) throw Forbidden("Only the org owner or an admin can delete this organization");
  await ref.delete();
  return { ok: true };
}
