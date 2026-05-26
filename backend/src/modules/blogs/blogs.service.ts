import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { newId, now, slugify } from "../../utils/ids";
import type { BlogDoc, UserDoc } from "../../types/domain";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const snap = await db.collection(Collections.blogs).where("slug", "==", candidate).limit(1).get();
    if (snap.empty) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createBlog(authorId: string, input: any) {
  const userSnap = await db.collection(Collections.users).doc(authorId).get();
  if (!userSnap.exists) throw NotFound("Author not found");
  const author = userSnap.data() as UserDoc;
  const id = newId();
  const slug = await uniqueSlug(input.title);
  const isPublished = input.status === "published";
  const doc: BlogDoc = {
    id,
    author_id: author.id,
    author_name: author.full_name,
    title: input.title,
    title_lower: String(input.title).toLowerCase(),
    slug,
    cover_image_url: input.cover_image_url,
    excerpt: input.excerpt ?? input.body_markdown.replace(/[#*`>_-]/g, "").slice(0, 240),
    body_markdown: input.body_markdown,
    tags: input.tags ?? [],
    sport: input.sport,
    status: isPublished ? "published" : "draft",
    like_count: 0,
    comment_count: 0,
    view_count: 0,
    published_at: isPublished ? now() : undefined,
    created_at: now(),
    updated_at: now()
  };
  await db.collection(Collections.blogs).doc(id).set(doc);
  return doc;
}

export async function updateBlog(id: string, actorId: string, isAdmin: boolean, patch: any) {
  const ref = db.collection(Collections.blogs).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Blog not found");
  const b = snap.data() as BlogDoc;
  if (b.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's blog");
  const update: any = { updated_at: now() };
  if (patch.title) {
    update.title = patch.title;
    update.title_lower = patch.title.toLowerCase();
  }
  for (const k of ["body_markdown", "excerpt", "cover_image_url", "tags", "sport"]) {
    if (patch[k] !== undefined) update[k] = patch[k];
  }
  if (patch.status) {
    if (patch.status === "published" && b.status !== "published") update.published_at = now();
    update.status = patch.status;
  }
  await ref.update(update);
  return { ...b, ...update };
}

export async function deleteBlog(id: string, actorId: string, isAdmin: boolean) {
  const ref = db.collection(Collections.blogs).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw NotFound("Blog not found");
  const b = snap.data() as BlogDoc;
  if (b.author_id !== actorId && !isAdmin) throw Forbidden();
  await ref.delete();
  return { ok: true };
}

export async function listBlogs(q: {
  author_id?: string;
  tag?: string;
  sport?: string;
  status?: "draft" | "published";
  limit: number;
  cursor?: string;
}) {
  let query: FirebaseFirestore.Query = db.collection(Collections.blogs);
  query = query.where("status", "==", q.status ?? "published");
  if (q.author_id) query = query.where("author_id", "==", q.author_id);
  if (q.sport) query = query.where("sport", "==", q.sport);
  query = query.orderBy("created_at", "desc").limit(q.limit);
  if (q.cursor) query = query.startAfter(Number(q.cursor));
  const snap = await query.get();
  let items = snap.docs.map((d) => d.data() as BlogDoc);
  if (q.tag) items = items.filter((b) => b.tags?.includes(q.tag!));
  return {
    items,
    next_cursor: snap.docs.length === q.limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null
  };
}

export async function getBlog(idOrSlug: string) {
  // Try id first, then slug.
  const byId = await db.collection(Collections.blogs).doc(idOrSlug).get();
  if (byId.exists) return enrich(byId.data() as BlogDoc, byId.ref);
  const bySlug = await db.collection(Collections.blogs).where("slug", "==", idOrSlug).limit(1).get();
  if (bySlug.empty) throw NotFound("Blog not found");
  return enrich(bySlug.docs[0].data() as BlogDoc, bySlug.docs[0].ref);
}

async function enrich(b: BlogDoc, ref: FirebaseFirestore.DocumentReference) {
  await ref.update({ view_count: FieldValue.increment(1) }).catch(() => undefined);
  return { ...b, view_count: (b.view_count ?? 0) + 1 };
}

export async function likeBlog(id: string, userId: string) {
  const ref = db.collection(Collections.blogs).doc(id);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (ex.exists) return;
    tx.set(likeRef, { user_id: userId, created_at: now() });
    tx.update(ref, { like_count: FieldValue.increment(1) });
  });
  return { ok: true };
}

export async function unlikeBlog(id: string, userId: string) {
  const ref = db.collection(Collections.blogs).doc(id);
  const likeRef = ref.collection("likes").doc(userId);
  await db.runTransaction(async (tx) => {
    const ex = await tx.get(likeRef);
    if (!ex.exists) return;
    tx.delete(likeRef);
    tx.update(ref, { like_count: FieldValue.increment(-1) });
  });
  return { ok: true };
}
