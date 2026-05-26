import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import type { OpportunityDoc, OrganizationDoc, Role } from "../../types/domain";

export async function createOpportunity(actorId: string, actorRole: Role, input: any) {
  const orgRef = db.collection(Collections.organizations).doc(input.org_id);
  const orgSnap = await orgRef.get();
  if (!orgSnap.exists) throw NotFound("Organization not found");
  const org = orgSnap.data() as OrganizationDoc;
  if (org.owner_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("You can only post opportunities for your own organization");

  const id = newId();
  const doc: OpportunityDoc = {
    id,
    org_id: org.id,
    org_name: org.org_name,
    posted_by_user_id: actorId,
    title: input.title,
    title_lower: String(input.title).toLowerCase(),
    type: input.type,
    sport: input.sport,
    description: input.description,
    eligibility: input.eligibility,
    age_min: input.age_min,
    age_max: input.age_max,
    gender_eligibility: input.gender_eligibility ?? "all",
    experience_level_required: input.experience_level_required ?? "any",
    country: input.country,
    state: input.state,
    city: input.city,
    start_date: input.start_date,
    end_date: input.end_date,
    application_deadline: input.application_deadline,
    entry_fee: input.entry_fee,
    documents_required: input.documents_required,
    vacancies: input.vacancies,
    vacancies_filled: 0,
    contact_email: input.contact_email ?? org.contact_email,
    contact_phone: input.contact_phone ?? org.contact_phone,
    status: "open",
    application_count: 0,
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.opportunities).doc(id).set(doc);
  return doc;
}

export async function updateOpportunity(id: string, actorId: string, actorRole: Role, patch: any) {
  const ref = db.collection(Collections.opportunities).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Opportunity not found");
  const opp = snap.data() as OpportunityDoc;
  if (opp.posted_by_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the poster or an admin can update this opportunity");
  const update: any = { updated_at: now() };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) update[k] = v;
  }
  if (patch.title) update.title_lower = String(patch.title).toLowerCase();
  await ref.update(update);
  return { ...opp, ...update } as OpportunityDoc;
}

export async function getOpportunity(id: string) {
  const snap = await db.collection(Collections.opportunities).doc(id).get();
  if (!snap.exists) throw NotFound("Opportunity not found");
  // Auto-close if deadline has passed (lightweight self-healing without a cron job).
  const opp = snap.data() as OpportunityDoc;
  if (opp.status === "open" && new Date(opp.application_deadline).getTime() < Date.now()) {
    await snap.ref.update({ status: "closed", updated_at: now() });
    opp.status = "closed";
  }
  return opp;
}

export async function deleteOpportunity(id: string, actorId: string, actorRole: Role) {
  const ref = db.collection(Collections.opportunities).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Opportunity not found");
  const opp = snap.data() as OpportunityDoc;
  if (opp.posted_by_user_id !== actorId && actorRole !== "admin")
    throw Forbidden("Only the poster or an admin can delete this opportunity");
  await ref.delete();
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
  // Firestore composite indexes power this — see infra/terraform/firestore.tf
  let query: FirebaseFirestore.Query = db.collection(Collections.opportunities);
  if (q.status) query = query.where("status", "==", q.status);
  if (q.sport) query = query.where("sport", "==", q.sport);
  if (q.type) query = query.where("type", "==", q.type);
  if (q.country) query = query.where("country", "==", q.country);
  if (q.city) query = query.where("city", "==", q.city);
  if (q.org_id) query = query.where("org_id", "==", q.org_id);
  query = query.orderBy("created_at", "desc").limit(q.limit);
  if (q.cursor) query = query.startAfter(Number(q.cursor));
  const snap = await query.get();
  const items = snap.docs.map((d) => d.data() as OpportunityDoc);
  const next_cursor = snap.docs.length === q.limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null;
  return { items, next_cursor };
}

export async function bumpApplicationCount(id: string, delta: number) {
  await db.collection(Collections.opportunities).doc(id).update({
    application_count: FieldValue.increment(delta),
    updated_at: now()
  });
}

export async function markFilled(id: string) {
  await db.collection(Collections.opportunities).doc(id).update({
    vacancies_filled: FieldValue.increment(1),
    updated_at: now()
  });
}
