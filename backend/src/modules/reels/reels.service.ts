import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";

export async function createReel(authorId: string, input: Record<string, unknown>) {
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw NotFound("Author not found");

  return prisma.reel.create({
    data: {
      author_id: authorId,
      title: input.title as string,
      description: input.description as string | undefined,
      video_url: input.video_url as string,
      thumbnail_url: input.thumbnail_url as string | undefined,
      duration_seconds: input.duration_seconds as number | undefined,
      sport: input.sport as string | undefined
    }
  });
}

export async function getReel(reelId: string) {
  const reel = await prisma.reel.findUnique({
    where: { id: reelId },
    include: { author: { select: { id: true, full_name: true, profile_photo_url: true } } }
  });
  if (!reel) throw NotFound("Reel not found");

  await prisma.$executeRaw`UPDATE "Reel" SET view_count = view_count + 1 WHERE id = ${reelId}::uuid`;

  return {
    ...reel,
    author_name: reel.author?.full_name ?? "Unknown",
    created_at: reel.created_at instanceof Date ? reel.created_at.getTime() : reel.created_at
  };
}

export async function deleteReel(reelId: string, actorId: string, isAdmin: boolean) {
  const reel = await prisma.reel.findUnique({ where: { id: reelId }, select: { author_id: true } });
  if (!reel) throw NotFound("Reel not found");
  if (reel.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's reel");
  await prisma.reel.delete({ where: { id: reelId } });
  return { ok: true };
}

export async function listReels(q: { author_id?: string; sport?: string; limit: number; cursor?: string }) {
  const where: Record<string, unknown> = {};
  if (q.author_id) where.author_id = q.author_id;
  if (q.sport) where.sport = { contains: q.sport, mode: "insensitive" };

  const rows = await prisma.reel.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, full_name: true, profile_photo_url: true } },
      _count: { select: { likes: true, comments: true } }
    }
  });

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const items = page.map(({ author, created_at, _count, ...r }) => ({
    ...r, author, author_name: author?.full_name ?? "Unknown",
    like_count: _count?.likes ?? r.like_count,
    comment_count: _count?.comments ?? r.comment_count,
    created_at: created_at instanceof Date ? created_at.getTime() : created_at
  }));
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function viewReel(reelId: string) {
  await prisma.$executeRaw`UPDATE "Reel" SET view_count = view_count + 1 WHERE id = ${reelId}::uuid`.catch(() => undefined);
  return { ok: true };
}

export async function likeReel(reelId: string, userId: string) {
  const exists = await prisma.reel.findUnique({ where: { id: reelId }, select: { id: true } });
  if (!exists) throw NotFound("Reel not found");

  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "ReelLike" (reel_id, user_id) VALUES (${reelId}::uuid, ${userId}::uuid) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`UPDATE "Reel" SET like_count = (SELECT COUNT(*) FROM "ReelLike" WHERE reel_id = ${reelId}::uuid) WHERE id = ${reelId}::uuid`
  ]);

  const updated = await prisma.reel.findUnique({ where: { id: reelId }, select: { like_count: true } });
  const liked = await prisma.reelLike.findUnique({
    where: { reel_id_user_id: { reel_id: reelId, user_id: userId } },
    select: { reel_id: true }
  });
  return { like_count: updated?.like_count ?? 0, liked: !!liked };
}

export async function unlikeReel(reelId: string, userId: string) {
  await prisma.$transaction([
    prisma.reelLike.deleteMany({ where: { reel_id: reelId, user_id: userId } }),
    prisma.$executeRaw`UPDATE "Reel" SET like_count = (SELECT COUNT(*) FROM "ReelLike" WHERE reel_id = ${reelId}::uuid) WHERE id = ${reelId}::uuid`
  ]);

  const updated = await prisma.reel.findUnique({ where: { id: reelId }, select: { like_count: true } });
  return { like_count: updated?.like_count ?? 0, liked: false };
}

export async function updateReel(reelId: string, actorId: string, isAdmin: boolean, input: { title?: string; description?: string; sport?: string }) {
  const reel = await prisma.reel.findUnique({ where: { id: reelId }, select: { author_id: true } });
  if (!reel) throw NotFound("Reel not found");
  if (reel.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's reel");

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.sport !== undefined) data.sport = input.sport;

  await prisma.reel.update({ where: { id: reelId }, data });
  return { ok: true };
}
