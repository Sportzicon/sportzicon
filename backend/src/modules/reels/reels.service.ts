import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import type { ReelDoc, UserDoc } from "../../types/domain";

export async function createReel(authorId: string, input: any, authorName?: string) {
  let author: Partial<UserDoc> = { id: authorId };
  const userSnap = await db.collection(Collections.users).doc(authorId).get();
  if (userSnap.exists) {
    const userData = userSnap.data() as UserDoc;
    author.full_name = userData.full_name;
  } else if (authorName) {
    author.full_name = authorName;
  } else {
    author.full_name = "Unknown";
  }

  const id = newId();
  const doc: ReelDoc = {
    id,
    author_id: author.id!,
    author_name: author.full_name || "Unknown",
    caption: input.caption,
    video_url: input.video_url,
    thumbnail_url: input.thumbnail_url,
    duration_seconds: input.duration_seconds,
    sport: input.sport,
    view_count: 0,
    like_count: 0,
    comment_count: 0,
    created_at: now()
  };
  await db.collection(Collections.reels).doc(id).set(doc);
  return doc;
}

export async function deleteReel(reelId: string, actorId: string, isAdmin: boolean) {
  const ref = db.collection(Collections.reels).doc(reelId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Reel not found");
  const r = snap.data() as ReelDoc;
  if (r.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's reel");
  await ref.delete();
  return { ok: true };
}

export async function listReels(q: { author_id?: string; sport?: string; limit: number; cursor?: string }) {
  let query: FirebaseFirestore.Query = db.collection(Collections.reels);
  if (q.author_id) query = query.where("author_id", "==", q.author_id);
  if (q.sport) query = query.where("sport", "==", q.sport);
  query = query.orderBy("created_at", "desc").limit(q.limit);
  if (q.cursor) query = query.startAfter(Number(q.cursor));
  const snap = await query.get();
  const items = snap.docs.map((d) => d.data() as ReelDoc);
  const next_cursor = snap.docs.length === q.limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null;
  return { items, next_cursor };
}

export async function viewReel(reelId: string) {
  await db
    .collection(Collections.reels)
    .doc(reelId)
    .update({ view_count: FieldValue.increment(1) })
    .catch(() => undefined);
  return { ok: true };
}

export async function likeReel(reelId: string, userId: string) {
  const ref = db.collection(Collections.reels).doc(reelId);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (ex.exists) return;
    tx.set(likeRef, { user_id: userId, created_at: now() });
    tx.update(ref, { like_count: FieldValue.increment(1) });
  });
  return { ok: true };
}

export async function unlikeReel(reelId: string, userId: string) {
  const ref = db.collection(Collections.reels).doc(reelId);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (!ex.exists) return;
    tx.delete(likeRef);
    tx.update(ref, { like_count: FieldValue.increment(-1) });
  });
  return { ok: true };
}

export async function updateReel(reelId: string, actorId: string, isAdmin: boolean, input: { caption?: string; sport?: string }) {
  const ref = db.collection(Collections.reels).doc(reelId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Reel not found");
  const r = snap.data() as ReelDoc;
  if (r.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's reel");
  const updates: any = {};
  if (input.caption !== undefined) updates.caption = input.caption;
  if (input.sport !== undefined) updates.sport = input.sport;
  await ref.update(updates);
  return { ok: true };
}
