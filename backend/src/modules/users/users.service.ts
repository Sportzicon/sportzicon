import { db, Collections } from "../../config/firestore";
import { Forbidden, NotFound } from "../../utils/errors";
import { now } from "../../utils/ids";
import type { UserDoc } from "../../types/domain";
import { publicUser } from "../auth/auth.service";

export async function getUserById(id: string) {
  const snap = await db.collection(Collections.users).doc(id).get();
  if (!snap.exists) throw NotFound("User not found");
  return publicUser(snap.data() as UserDoc);
}

export async function updateProfile(
  userId: string,
  patch: Partial<UserDoc> & { athlete?: any; coach?: any }
) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  const user = snap.data() as UserDoc;

  const update: any = { updated_at: now() };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    update[k] = v;
  }
  if (patch.full_name) update.full_name_lower = patch.full_name.toLowerCase();

  await ref.update(update);
  const after = (await ref.get()).data() as UserDoc;
  return publicUser(after);
}

export async function updateAthleteFields(userId: string, fields: any) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  const user = snap.data() as UserDoc;
  if (user.role !== "athlete") throw Forbidden("Only athletes can update athlete fields");
  await ref.update({ athlete: { ...(user.athlete ?? {}), ...fields }, updated_at: now() });
  return publicUser({ ...user, athlete: { ...(user.athlete ?? {}), ...fields } } as UserDoc);
}

export async function updateCoachFields(userId: string, fields: any) {
  const ref = db.collection(Collections.users).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("User not found");
  const user = snap.data() as UserDoc;
  if (user.role !== "scout" && user.role !== "organizer")
    throw Forbidden("Only scouts/organizers can update coach fields");
  await ref.update({ coach: { ...(user.coach ?? {}), ...fields }, updated_at: now() });
  return publicUser({ ...user, coach: { ...(user.coach ?? {}), ...fields } } as UserDoc);
}
