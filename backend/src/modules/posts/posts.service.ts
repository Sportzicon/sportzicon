import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";

export async function createPost(authorId: string, input: Record<string, unknown>) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true, full_name: true, role: true }
  });
  if (!author) throw NotFound("Author not found");

  return prisma.post.create({
    data: {
      author_id: authorId,
      type: (input.type as string) ?? "post",
      text: input.text as string,
      media_urls: (input.media_urls as string[]) ?? [],
      sport: input.sport as string | undefined,
      tags: (input.tags as string[]) ?? []
    }
  });
}

export async function updatePost(
  postId: string,
  actorId: string,
  isAdmin: boolean,
  input: { text?: string; tags?: string[] }
) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { author_id: true } });
  if (!post) throw NotFound("Post not found");
  if (post.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's post");

  const data: Record<string, unknown> = {};
  if (input.text  !== undefined) data.text = input.text;
  if (input.tags  !== undefined) data.tags = input.tags;

  await prisma.post.update({ where: { id: postId }, data });
  return { ok: true };
}

export async function deletePost(postId: string, actorId: string, isAdmin: boolean) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { author_id: true } });
  if (!post) throw NotFound("Post not found");
  if (post.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's post");
  await prisma.post.delete({ where: { id: postId } });
  return { ok: true };
}

export async function listPosts(q: {
  author_id?: string;
  sport?: string;
  type?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = {};
  if (q.author_id) where.author_id = q.author_id;
  if (q.sport)     where.sport = { contains: q.sport, mode: "insensitive" };
  if (q.type)      where.type = q.type;

  const rows = await prisma.post.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, full_name: true, role: true, profile_photo_url: true } },
      _count: { select: { likes: true, comments: true } }
    }
  });

  const hasMore = rows.length > q.limit;
  const page    = hasMore ? rows.slice(0, q.limit) : rows;
  const items   = page.map(flattenPost);
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function feedForUser(userId: string, limit = 20) {
  const followeeIds = await prisma.follow
    .findMany({ where: { follower_id: userId }, select: { followee_id: true } })
    .then((rows) => rows.map((r) => r.followee_id));

  const rows = await prisma.post.findMany({
    where: { author_id: { in: [userId, ...followeeIds] } },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      author: { select: { id: true, full_name: true, role: true, profile_photo_url: true } },
      _count: { select: { likes: true, comments: true } }
    }
  });

  return { items: rows.map(flattenPost) };
}

export async function likePost(postId: string, userId: string) {
  const exists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!exists) throw NotFound("Post not found");

  const already = await prisma.postLike.findUnique({
    where: { post_id_user_id: { post_id: postId, user_id: userId } },
    select: { post_id: true }
  });
  if (already) return { ok: true };

  await prisma.$transaction([
    prisma.postLike.create({ data: { post_id: postId, user_id: userId } }),
    prisma.post.update({ where: { id: postId }, data: { like_count: { increment: 1 } } })
  ]);
  return { ok: true };
}

export async function unlikePost(postId: string, userId: string) {
  const already = await prisma.postLike.findUnique({
    where: { post_id_user_id: { post_id: postId, user_id: userId } },
    select: { post_id: true }
  });
  if (!already) return { ok: true };

  await prisma.$transaction([
    prisma.postLike.delete({ where: { post_id_user_id: { post_id: postId, user_id: userId } } }),
    prisma.post.update({ where: { id: postId }, data: { like_count: { decrement: 1 } } })
  ]);
  return { ok: true };
}

// ── Internal helper ───────────────────────────────────────────────────────────

function flattenPost(row: any) {
  const { author, created_at, updated_at, _count, ...rest } = row;
  return {
    ...rest,
    author,
    author_name:   author?.full_name ?? "Unknown",
    author_role:   author?.role,
    like_count:    _count?.likes    ?? rest.like_count,
    comment_count: _count?.comments ?? rest.comment_count,
    created_at:    created_at instanceof Date ? created_at.getTime() : created_at,
    updated_at:    updated_at instanceof Date ? updated_at.getTime() : updated_at
  };
}
