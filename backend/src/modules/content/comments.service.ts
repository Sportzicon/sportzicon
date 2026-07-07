import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";

export async function addComment(contentId: string, authorId: string, text: string) {
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true, full_name: true } });
  if (!author) throw NotFound("Author not found");

  const content = await prisma.content.findUnique({ where: { id: contentId }, select: { id: true } });
  if (!content) throw NotFound("Content not found");

  const [comment] = await prisma.$transaction([
    prisma.comment.create({ data: { content_id: contentId, author_id: authorId, text } }),
    prisma.content.update({ where: { id: contentId }, data: { comment_count: { increment: 1 } } }),
  ]);

  return {
    ...comment,
    author_name: author.full_name,
    like_count: 0,
    liked: false,
    created_at: comment.created_at.getTime(),
  };
}

export async function listComments(
  contentId: string,
  opts: { cursor?: string; limit?: number; userId?: string } = {}
) {
  const { cursor, limit = 20, userId } = opts;

  const rows = await prisma.comment.findMany({
    where: { content_id: contentId },
    orderBy: { created_at: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, full_name: true, profile_photo_url: true } },
      ...(userId ? { likes: { where: { user_id: userId }, select: { user_id: true } } } : {}),
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const data = page.map(({ author, likes, ...c }: any) => ({
    ...c,
    author,
    author_name: author?.full_name ?? "Unknown",
    liked: Array.isArray(likes) && likes.length > 0,
    created_at: c.created_at.getTime(),
  }));
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function likeComment(commentId: string, userId: string) {
  const exists = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!exists) throw NotFound("Comment not found");

  const [, countResult] = await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "CommentLike" (comment_id, user_id) VALUES (${commentId}::uuid, ${userId}::uuid) ON CONFLICT DO NOTHING`,
    prisma.$queryRaw<[{ like_count: bigint }]>`
      UPDATE "Comment" SET like_count = (SELECT COUNT(*) FROM "CommentLike" WHERE comment_id = ${commentId}::uuid)
      WHERE id = ${commentId}::uuid RETURNING like_count`,
  ]);

  return { like_count: Number((countResult as any)[0]?.like_count ?? 0), liked: true };
}

export async function unlikeComment(commentId: string, userId: string) {
  const exists = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
  if (!exists) throw NotFound("Comment not found");

  const [, countResult] = await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "CommentLike" WHERE comment_id = ${commentId}::uuid AND user_id = ${userId}::uuid`,
    prisma.$queryRaw<[{ like_count: bigint }]>`
      UPDATE "Comment" SET like_count = (SELECT COUNT(*) FROM "CommentLike" WHERE comment_id = ${commentId}::uuid)
      WHERE id = ${commentId}::uuid RETURNING like_count`,
  ]);

  return { like_count: Number((countResult as any)[0]?.like_count ?? 0), liked: false };
}

export async function updateComment(commentId: string, actorId: string, isAdmin: boolean, text: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { author_id: true } });
  if (!comment) throw NotFound("Comment not found");
  if (comment.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's comment");

  await prisma.comment.update({ where: { id: commentId }, data: { text } });
  return { ok: true };
}

export async function deleteComment(commentId: string, actorId: string, isAdmin: boolean) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { author_id: true, content_id: true } });
  if (!comment) throw NotFound("Comment not found");
  if (comment.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's comment");

  await prisma.$transaction([
    prisma.comment.delete({ where: { id: commentId } }),
    prisma.content.update({ where: { id: comment.content_id }, data: { comment_count: { decrement: 1 } } }),
  ]);
  return { ok: true };
}
