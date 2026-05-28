import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { BadRequest, NotFound } from "../../utils/errors";
import { now, pairId } from "../../utils/ids";
import { createNotification } from "../notifications/notifications.service";
import type { UserDoc } from "../../types/domain";

export async function follow(followerId: string, followeeId: string) {
  if (followerId === followeeId) throw BadRequest("You cannot follow yourself");

  const followeeRef = db.collection(Collections.users).doc(followeeId);
  const followerRef = db.collection(Collections.users).doc(followerId);
  // Composite id so the (a,b) pair is unique — also makes unfollow a single-doc delete.
  const followDocId = `${followerId}_${followeeId}`;
  const followRef = db.collection(Collections.follows).doc(followDocId);

  const result = await db.runTransaction(async (tx) => {
    const [followeeSnap, followerSnap, existingSnap] = await Promise.all([
      tx.get(followeeRef),
      tx.get(followerRef),
      tx.get(followRef)
    ]);
    if (!followeeSnap.exists) throw NotFound("User to follow not found");
    if (!followerSnap.exists) throw NotFound("Follower not found");
    if (existingSnap.exists) return { already: true };

    tx.set(followRef, {
      id: followDocId,
      follower_id: followerId,
      followee_id: followeeId,
      created_at: now()
    });
    tx.update(followeeRef, { follower_count: FieldValue.increment(1), updated_at: now() });
    tx.update(followerRef, { following_count: FieldValue.increment(1), updated_at: now() });
    return { already: false, followerName: (followerSnap.data() as UserDoc).full_name };
  });

  if (!result.already) {
    await createNotification({
      user_id: followeeId,
      type: "new_follower",
      title: "New follower",
      body: `${result.followerName} started following you.`,
      link: `/profile/${followerId}`
    });
  }
  return { ok: true };
}

export async function unfollow(followerId: string, followeeId: string) {
  if (followerId === followeeId) throw BadRequest("Invalid request");

  const followDocId = `${followerId}_${followeeId}`;
  const followRef = db.collection(Collections.follows).doc(followDocId);
  const followeeRef = db.collection(Collections.users).doc(followeeId);
  const followerRef = db.collection(Collections.users).doc(followerId);

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(followRef);
    if (!existing.exists) return;
    tx.delete(followRef);
    tx.update(followeeRef, { follower_count: FieldValue.increment(-1), updated_at: now() });
    tx.update(followerRef, { following_count: FieldValue.increment(-1), updated_at: now() });
  });
  return { ok: true };
}

export async function isFollowing(followerId: string, followeeId: string) {
  const snap = await db.collection(Collections.follows).doc(`${followerId}_${followeeId}`).get();
  return snap.exists;
}

export async function listFollowers(userId: string, limit = 50, _cursor?: string) {
  const snap = await db
    .collection(Collections.follows)
    .where("followee_id", "==", userId)
    .limit(limit)
    .get();
  const docs = snap.docs.sort((a, b) => b.get("created_at") - a.get("created_at"));
  const ids = docs.map((d) => d.get("follower_id"));
  const users = await fetchUsersByIds(ids as string[]);
  return { items: users, next_cursor: null };
}

export async function listFollowing(userId: string, limit = 50, _cursor?: string) {
  const snap = await db
    .collection(Collections.follows)
    .where("follower_id", "==", userId)
    .limit(limit)
    .get();
  const docs = snap.docs.sort((a, b) => b.get("created_at") - a.get("created_at"));
  const ids = docs.map((d) => d.get("followee_id"));
  const users = await fetchUsersByIds(ids as string[]);
  return { items: users, next_cursor: null };
}

async function fetchUsersByIds(ids: string[]) {
  if (ids.length === 0) return [];
  // Firestore "in" supports up to 30 values — chunk if necessary.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((c) => db.collection(Collections.users).where("id", "in", c).get())
  );
  const out: any[] = [];
  for (const r of results) {
    for (const d of r.docs) {
      const u = d.data() as UserDoc;
      out.push({
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        profile_photo_url: u.profile_photo_url,
        verification: u.verification,
        bio: u.bio,
        country: u.country,
        city: u.city
      });
    }
  }
  return out;
}
