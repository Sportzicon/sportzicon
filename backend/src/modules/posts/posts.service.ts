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

export async function deletePost(postId: string, actorId: string, isAdmin: boolean) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { author_id: true } });
  if (!post) throw NotFound("Post not found");
  if (post.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's post");
  await prisma.post.delete({ where: { id: postId } });
  return { ok: true };
}

export async function listPosts(q: { author_id?: string; sport?: string; type?: string; limit: number; cursor?: string }) {
  const where: Record<string, unknown> = {};
  if (q.author_id) where.author_id = q.author_id;
  if (q.sport) where.sport = { contains: q.sport, mode: "insensitive" };
  if (q.type) where.type = q.type;

  const rows = await prisma.post.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { author: { select: { id: true, full_name: true, role: true, profile_photo_url: true } }, _count: { select: { likes: true, comments: true } } }
  });

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const items = page.map(flattenPost);
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function feedForUser(userId: string, limit = 20) {
  const followeeIds = await prisma.follow.findMany({
    where: { follower_id: userId },
    select: { followee_id: true }
  }).then((rows) => rows.map((r) => r.followee_id));

  const rows = await prisma.post.findMany({
    where: { author_id: { in: [userId, ...followeeIds] } },
    orderBy: { created_at: "desc" },
    take: limit,
    include: { author: { select: { id: true, full_name: true, role: true, profile_photo_url: true } }, _count: { select: { likes: true, comments: true } } }
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

export async function addComment(
  parent: { type: "post" | "reel" | "blog"; id: string },
  authorId: string,
  text: string
) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true }
  });
  if (!author) throw NotFound("Author not found");

  const parentExists = parent.type === "post"
    ? await prisma.post.findUnique({ where: { id: parent.id }, select: { id: true } })
    : parent.type === "reel"
    ? await prisma.reel.findUnique({ where: { id: parent.id }, select: { id: true } })
    : await prisma.blog.findUnique({ where: { id: parent.id }, select: { id: true } });
  if (!parentExists) throw NotFound(`${parent.type} not found`);

  const commentData: Record<string, unknown> = {
    parent_type: parent.type,
    author_id: authorId,
    text,
    ...(parent.type === "post" ? { post_id: parent.id } : {}),
    ...(parent.type === "reel" ? { reel_id: parent.id } : {}),
    ...(parent.type === "blog" ? { blog_id: parent.id } : {})
  };

  const parentUpdate =
    parent.type === "post"
      ? prisma.post.update({ where: { id: parent.id }, data: { comment_count: { increment: 1 } } })
      : parent.type === "reel"
      ? prisma.reel.update({ where: { id: parent.id }, data: { comment_count: { increment: 1 } } })
      : prisma.blog.update({ where: { id: parent.id }, data: { comment_count: { increment: 1 } } });

  const [comment] = await prisma.$transaction([
    prisma.comment.create({ data: commentData as any }),
    parentUpdate
  ]);

  return {
    ...comment,
    author_name: (await prisma.user.findUnique({ where: { id: authorId }, select: { full_name: true } }))?.full_name ?? "Unknown",
    created_at: comment.created_at.getTime()
  };
}

export async function listComments(parentType: "post" | "reel" | "blog", parentId: string, limit = 50) {
  const where: Record<string, unknown> = { parent_type: parentType };
  if (parentType === "post") where.post_id = parentId;
  else if (parentType === "reel") where.reel_id = parentId;
  else where.blog_id = parentId;

  const rows = await prisma.comment.findMany({
    where,
    orderBy: { created_at: "asc" },
    take: limit,
    include: { author: { select: { id: true, full_name: true, profile_photo_url: true } } }
  });
  return rows.map(({ author, ...c }) => ({
    ...c,
    author,
    author_name: author?.full_name ?? "Unknown",
    created_at: c.created_at.getTime()
  }));
}

export async function updatePost(postId: string, actorId: string, isAdmin: boolean, input: { text?: string; tags?: string[] }) {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { author_id: true } });
  if (!post) throw NotFound("Post not found");
  if (post.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's post");

  const data: Record<string, unknown> = {};
  if (input.text !== undefined) data.text = input.text;
  if (input.tags !== undefined) data.tags = input.tags;

  await prisma.post.update({ where: { id: postId }, data });
  return { ok: true };
}

export async function updateComment(commentId: string, actorId: string, isAdmin: boolean, text: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { author_id: true } });
  if (!comment) throw NotFound("Comment not found");
  if (comment.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's comment");
  await prisma.comment.update({ where: { id: commentId }, data: { text } });
  return { ok: true };
}

export async function deleteComment(commentId: string, actorId: string, isAdmin: boolean) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { author_id: true, parent_type: true, post_id: true, reel_id: true, blog_id: true }
  });
  if (!comment) throw NotFound("Comment not found");
  if (comment.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's comment");

  const parentUpdate =
    comment.parent_type === "post" && comment.post_id
      ? prisma.post.update({ where: { id: comment.post_id }, data: { comment_count: { decrement: 1 } } })
      : comment.parent_type === "reel" && comment.reel_id
      ? prisma.reel.update({ where: { id: comment.reel_id }, data: { comment_count: { decrement: 1 } } })
      : comment.parent_type === "blog" && comment.blog_id
      ? prisma.blog.update({ where: { id: comment.blog_id }, data: { comment_count: { decrement: 1 } } })
      : null;

  const ops: any[] = [prisma.comment.delete({ where: { id: commentId } })];
  if (parentUpdate) ops.push(parentUpdate);
  await prisma.$transaction(ops);

  return { ok: true };
}

// Flattens the nested author include into backward-compatible flat fields.
// Uses _count from Prisma include to override stale stored counters.
function flattenPost(row: any) {
  const { author, created_at, updated_at, _count, ...rest } = row;
  return {
    ...rest,
    author,
    author_name: author?.full_name ?? "Unknown",
    author_role: author?.role,
    like_count: _count?.likes ?? rest.like_count,
    comment_count: _count?.comments ?? rest.comment_count,
    created_at: created_at instanceof Date ? created_at.getTime() : created_at,
    updated_at: updated_at instanceof Date ? updated_at.getTime() : updated_at
  };
}
