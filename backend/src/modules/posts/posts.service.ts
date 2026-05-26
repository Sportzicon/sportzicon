import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { Forbidden, NotFound } from "../../utils/errors";
import { newId, now } from "../../utils/ids";
import type { CommentDoc, PostDoc, UserDoc } from "../../types/domain";

export async function createPost(authorId: string, input: any) {
  const userSnap = await db.collection(Collections.users).doc(authorId).get();
  if (!userSnap.exists) throw NotFound("Author not found");
  const author = userSnap.data() as UserDoc;
  const id = newId();
  const doc: PostDoc = {
    id,
    author_id: author.id,
    author_name: author.full_name,
    author_role: author.role,
    type: input.type ?? "post",
    text: input.text,
    media_urls: input.media_urls ?? [],
    sport: input.sport,
    tags: input.tags ?? [],
    like_count: 0,
    comment_count: 0,
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.posts).doc(id).set(doc);
  return doc;
}

export async function deletePost(postId: string, actorId: string, isAdmin: boolean) {
  const ref = db.collection(Collections.posts).doc(postId);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Post not found");
  const p = snap.data() as PostDoc;
  if (p.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's post");
  await ref.delete();
  return { ok: true };
}

export async function listPosts(q: { author_id?: string; sport?: string; type?: "post" | "log"; limit: number; cursor?: string }) {
  let query: FirebaseFirestore.Query = db.collection(Collections.posts);
  if (q.author_id) query = query.where("author_id", "==", q.author_id);
  if (q.sport) query = query.where("sport", "==", q.sport);
  if (q.type) query = query.where("type", "==", q.type);
  query = query.orderBy("created_at", "desc").limit(q.limit);
  if (q.cursor) query = query.startAfter(Number(q.cursor));
  const snap = await query.get();
  const items = snap.docs.map((d) => d.data() as PostDoc);
  const next_cursor = snap.docs.length === q.limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null;
  return { items, next_cursor };
}

// Feed for the current user: their own posts plus posts from those they follow.
export async function feedForUser(userId: string, limit = 20) {
  const followSnap = await db
    .collection(Collections.follows)
    .where("follower_id", "==", userId)
    .limit(500)
    .get();
  const followeeIds = followSnap.docs.map((d) => d.get("followee_id") as string);
  const ids = [userId, ...followeeIds];
  if (ids.length === 0) return { items: [] };

  // Firestore "in" is capped at 30 — chunk and merge.
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((c) =>
      db.collection(Collections.posts).where("author_id", "in", c).orderBy("created_at", "desc").limit(limit).get()
    )
  );
  const merged: PostDoc[] = [];
  for (const r of results) for (const d of r.docs) merged.push(d.data() as PostDoc);
  merged.sort((a, b) => b.created_at - a.created_at);
  return { items: merged.slice(0, limit) };
}

export async function likePost(postId: string, userId: string) {
  const ref = db.collection(Collections.posts).doc(postId);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (ex.exists) return;
    tx.set(likeRef, { user_id: userId, created_at: now() });
    tx.update(ref, { like_count: FieldValue.increment(1) });
  });
  return { ok: true };
}

export async function unlikePost(postId: string, userId: string) {
  const ref = db.collection(Collections.posts).doc(postId);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (!ex.exists) return;
    tx.delete(likeRef);
    tx.update(ref, { like_count: FieldValue.increment(-1) });
  });
  return { ok: true };
}

export async function addComment(parent: { type: "post" | "reel" | "blog"; id: string }, authorId: string, text: string) {
  const userSnap = await db.collection(Collections.users).doc(authorId).get();
  if (!userSnap.exists) throw NotFound("Author not found");
  const author = userSnap.data() as UserDoc;
  const id = newId();
  const collection =
    parent.type === "post" ? Collections.posts : parent.type === "reel" ? Collections.reels : Collections.blogs;
  const parentRef = db.collection(collection).doc(parent.id);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) throw NotFound(`${parent.type} not found`);

  const doc: CommentDoc = {
    id,
    parent_type: parent.type,
    parent_id: parent.id,
    author_id: author.id,
    author_name: author.full_name,
    text,
    created_at: now()
  };
  await db.runTransaction(async (tx) => {
    tx.set(db.collection(Collections.comments).doc(id), doc);
    tx.update(parentRef, { comment_count: FieldValue.increment(1), updated_at: now() });
  });
  return doc;
}

export async function listComments(parentType: "post" | "reel" | "blog", parentId: string, limit = 50) {
  const snap = await db
    .collection(Collections.comments)
    .where("parent_type", "==", parentType)
    .where("parent_id", "==", parentId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as CommentDoc);
}
