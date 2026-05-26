import { db, Collections } from "../../config/firestore";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import { createNotification } from "../notifications/notifications.service";
import type { EntityType, Role, VerificationDoc } from "../../types/domain";

const VALID_TYPES: Record<EntityType, string[]> = {
  user: ["athlete_id", "coach_license", "scout_id", "stats_endorsement"],
  organization: ["org_registration"]
};

export async function submit(input: {
  actorId: string;
  entity_type: EntityType;
  entity_id: string;
  verification_type: string;
  documents: string[];
  notes?: string;
}) {
  if (!VALID_TYPES[input.entity_type]?.includes(input.verification_type))
    throw BadRequest(`Invalid verification_type for ${input.entity_type}`);
  if (input.documents.length === 0) throw BadRequest("At least one document is required");

  // Authorisation:
  //  - user entity: only the user themselves
  //  - organization entity: only the owner
  if (input.entity_type === "user" && input.entity_id !== input.actorId)
    throw Forbidden("Cannot submit verification for another user");
  if (input.entity_type === "organization") {
    const orgSnap = await db.collection(Collections.organizations).doc(input.entity_id).get();
    if (!orgSnap.exists) throw NotFound("Organization not found");
    if (orgSnap.get("owner_user_id") !== input.actorId)
      throw Forbidden("Cannot submit verification for an organization you do not own");
  }

  const id = newId();
  const doc: VerificationDoc = {
    id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    verification_type: input.verification_type,
    documents: input.documents,
    notes: input.notes,
    status: "pending",
    submitted_by: input.actorId,
    created_at: now()
  };
  await db.collection(Collections.verifications).doc(id).set(doc);

  // Reflect "pending" on the target entity so the badge UI can show progress.
  const col = input.entity_type === "user" ? Collections.users : Collections.organizations;
  await db.collection(col).doc(input.entity_id).update({
    "verification.status": "pending",
    updated_at: now()
  });

  return doc;
}

export async function listPending(limit = 100) {
  const snap = await db
    .collection(Collections.verifications)
    .where("status", "==", "pending")
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as VerificationDoc);
}

export async function review(id: string, reviewerId: string, decision: "approve" | "reject", reason?: string) {
  const ref = db.collection(Collections.verifications).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Verification not found");
  const v = snap.data() as VerificationDoc;
  if (v.status !== "pending") throw BadRequest("Verification already reviewed");

  const newStatus = decision === "approve" ? "approved" : "rejected";
  const col = v.entity_type === "user" ? Collections.users : Collections.organizations;
  const targetRef = db.collection(col).doc(v.entity_id);

  await db.runTransaction(async (tx) => {
    tx.update(ref, {
      status: newStatus,
      reviewed_by: reviewerId,
      reviewed_at: now(),
      rejection_reason: decision === "reject" ? reason : undefined
    });
    const badgeMap: Record<string, string> = {
      athlete_id: "verified_player",
      coach_license: "verified_coach",
      scout_id: "verified_scout",
      stats_endorsement: "verified_stats",
      org_registration: "verified_org"
    };
    const badge = badgeMap[v.verification_type];
    const targetSnap = await tx.get(targetRef);
    const existing: string[] = (targetSnap.get("verification.badges") as string[]) ?? [];
    const badges =
      decision === "approve" && badge && !existing.includes(badge) ? [...existing, badge] : existing;
    tx.update(targetRef, {
      "verification.status": newStatus,
      "verification.badges": badges,
      updated_at: now()
    });
  });

  // Notify the entity owner (for an org we need its owner_user_id; for a user it's the user themselves).
  let notifyUserId = v.entity_id;
  if (v.entity_type === "organization") {
    const ownerSnap = await targetRef.get();
    notifyUserId = ownerSnap.get("owner_user_id");
  }
  await createNotification({
    user_id: notifyUserId,
    type: `verification_${newStatus}`,
    title: `Verification ${newStatus}`,
    body:
      decision === "approve"
        ? "Your verification has been approved and your badge is now visible on your profile."
        : `Your verification was rejected.${reason ? " Reason: " + reason : ""}`,
    email: true
  });

  return { ...v, status: newStatus };
}
