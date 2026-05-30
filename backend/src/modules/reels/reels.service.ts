import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";

export async function createReel(authorId: string, input: Record<string, unknown>) {
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw NotFound("Author not found");

  return prisma.reel.create({
    data: {
      author_id: authorId,
      caption: input.caption as string | undefined,
      video_url: input.video_url as string,
      thumbnail_url: input.thumbnail_url as string | undefined,
      duration_seconds: input.duration_seconds as number | undefined,
      sport: input.sport as string | undefined
    }
  });
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
  if (q.sport) where.sport = q.sport;

  const items = await prisma.reel.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { author: { select: { id: true, full_name: true, profile_photo_url: true } } }
  });

  const hasMore = items.length > q.limit;
  const page = hasMore ? items.slice(0, q.limit) : items;
  return { items: page, next_cursor: hasMore ? page[page.length - 1].id : null };
}

export async function viewReel(reelId: string) {
  await prisma.reel.update({
    where: { id: reelId },
    data: { view_count: { increment: 1 } }
  }).catch(() => undefined);
  return { ok: true };
}

export async function likeReel(reelId: string, userId: string) {
  const exists = await prisma.reel.findUnique({ where: { id: reelId }, select: { id: true } });
  if (!exists) throw NotFound("Reel not found");

  const already = await prisma.reelLike.findUnique({
    where: { reel_id_user_id: { reel_id: reelId, user_id: userId } },
    select: { reel_id: true }
  });
  if (already) return { ok: true };

  await prisma.$transaction([
    prisma.reelLike.create({ data: { reel_id: reelId, user_id: userId } }),
    prisma.reel.update({ where: { id: reelId }, data: { like_count: { increment: 1 } } })
  ]);
  return { ok: true };
}

export async function unlikeReel(reelId: string, userId: string) {
  const already = await prisma.reelLike.findUnique({
    where: { reel_id_user_id: { reel_id: reelId, user_id: userId } },
    select: { reel_id: true }
  });
  if (!already) return { ok: true };

  await prisma.$transaction([
    prisma.reelLike.delete({ where: { reel_id_user_id: { reel_id: reelId, user_id: userId } } }),
    prisma.reel.update({ where: { id: reelId }, data: { like_count: { decrement: 1 } } })
  ]);
  return { ok: true };
}

export async function updateReel(reelId: string, actorId: string, isAdmin: boolean, input: { caption?: string; sport?: string }) {
  const reel = await prisma.reel.findUnique({ where: { id: reelId }, select: { author_id: true } });
  if (!reel) throw NotFound("Reel not found");
  if (reel.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's reel");

  const data: Record<string, unknown> = {};
  if (input.caption !== undefined) data.caption = input.caption;
  if (input.sport !== undefined) data.sport = input.sport;

  await prisma.reel.update({ where: { id: reelId }, data });
  return { ok: true };
}
