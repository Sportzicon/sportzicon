import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";

type ParentType = "post" | "reel" | "blog";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveParent(type: ParentType, id: string) {
  const record =
    type === "post" ? await prisma.post.findUnique({ where: { id }, select: { id: true } })
    : type === "reel" ? await prisma.reel.findUnique({ where: { id }, select: { id: true } })
    : await prisma.blog.findUnique({ where: { id }, select: { id: true } });

  if (!record) throw NotFound(`${type} not found`);
}

function parentCountUpdate(type: ParentType, id: string, delta: 1 | -1) {
  const data = { comment_count: delta === 1 ? { increment: 1 } : { decrement: 1 } };
  if (type === "post")  return prisma.post.update({ where: { id }, data });
  if (type === "reel")  return prisma.reel.update({ where: { id }, data });
  return prisma.blog.update({ where: { id }, data });
}

function parentIdField(type: ParentType, id: string): Record<string, string> {
  if (type === "post")  return { post_id: id };
  if (type === "reel")  return { reel_id: id };
  return { blog_id: id };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function addComment(
  parent: { type: ParentType; id: string },
  authorId: string,
  text: string
) {
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true, full_name: true }
  });
  if (!author) throw NotFound("Author not found");

  await resolveParent(parent.type, parent.id);

  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: {
        parent_type: parent.type,
        author_id: authorId,
        text,
        ...parentIdField(parent.type, parent.id)
      } as any
    }),
    parentCountUpdate(parent.type, parent.id, 1)
  ]);

  return {
    ...comment,
    author_name: author.full_name,
    created_at: comment.created_at.getTime()
  };
}

export async function listComments(
  parentType: ParentType,
  parentId: string,
  opts: { cursor?: string; limit?: number } = {}
) {
  const { cursor, limit = 20 } = opts;
  const where: Record<string, unknown> = {
    parent_type: parentType,
    ...parentIdField(parentType, parentId)
  };

  const rows = await prisma.comment.findMany({
    where,
    orderBy: { created_at: "asc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { author: { select: { id: true, full_name: true, profile_photo_url: true } } }
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const data = page.map(({ author, ...c }) => ({
    ...c,
    author,
    author_name: author?.full_name ?? "Unknown",
    created_at: c.created_at.getTime()
  }));
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function updateComment(commentId: string, actorId: string, isAdmin: boolean, text: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { author_id: true }
  });
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

  const parentType = comment.parent_type as ParentType;
  const parentId =
    parentType === "post"  ? comment.post_id
    : parentType === "reel" ? comment.reel_id
    : comment.blog_id;

  const ops: any[] = [prisma.comment.delete({ where: { id: commentId } })];
  if (parentId) ops.push(parentCountUpdate(parentType, parentId, -1));

  await prisma.$transaction(ops);
  return { ok: true };
}
