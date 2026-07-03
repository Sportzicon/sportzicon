import { prisma } from "../../config/prisma";
import { BadRequest, NotFound } from "../../utils/errors";
import { eventBus } from "../../lib/EventBus";
import { cacheDel } from "../../config/redis";
import { logger } from "../../config/logger";
import { USER_FOLLOWED, type UserFollowedEvent } from "../../events/types";
import { Prisma } from "@prisma/client";

export async function follow(followerId: string, followeeId: string) {
  if (followerId === followeeId) throw BadRequest("You cannot follow yourself");

  const [followee, follower] = await Promise.all([
    prisma.user.findUnique({ where: { id: followeeId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: followerId }, select: { id: true, full_name: true } })
  ]);
  if (!followee) throw NotFound("User to follow not found");
  if (!follower) throw NotFound("Follower not found");

  const existing = await prisma.follow.findUnique({
    where: { follower_id_followee_id: { follower_id: followerId, followee_id: followeeId } },
    select: { follower_id: true }
  });
  if (existing) return { ok: true };

  try {
    await prisma.follow.create({ data: { follower_id: followerId, followee_id: followeeId } });
  } catch (err) {
    // Unique constraint: concurrent follow request already created the row — treat as idempotent.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      logger.info({ followerId, followeeId }, "follow: concurrent duplicate ignored");
      return { ok: true };
    }
    logger.error({ err, followerId, followeeId }, "follow: transaction failed");
    throw err;
  }

  eventBus.emit<UserFollowedEvent>(USER_FOLLOWED, {
    followerId,
    followerName: follower.full_name,
    followeeId,
  });

  await cacheDel(`user:profile:${followeeId}`, `user:profile:${followerId}`);
  return { ok: true };
}

export async function unfollow(followerId: string, followeeId: string) {
  if (followerId === followeeId) throw BadRequest("Invalid request");

  const existing = await prisma.follow.findUnique({
    where: { follower_id_followee_id: { follower_id: followerId, followee_id: followeeId } },
    select: { follower_id: true }
  });
  if (!existing) return { ok: true };

  try {
    await prisma.follow.delete({ where: { follower_id_followee_id: { follower_id: followerId, followee_id: followeeId } } });
  } catch (err) {
    // Record was deleted by a concurrent unfollow — treat as idempotent.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      logger.info({ followerId, followeeId }, "unfollow: concurrent deletion ignored");
      return { ok: true };
    }
    logger.error({ err, followerId, followeeId }, "unfollow: transaction failed");
    throw err;
  }

  await cacheDel(`user:profile:${followeeId}`, `user:profile:${followerId}`);
  return { ok: true };
}

export async function isFollowing(followerId: string, followeeId: string) {
  const r = await prisma.follow.findUnique({
    where: { follower_id_followee_id: { follower_id: followerId, followee_id: followeeId } },
    select: { follower_id: true }
  });
  return Boolean(r);
}

export async function listFollowers(userId: string, limit = 50) {
  const follows = await prisma.follow.findMany({
    where: { followee_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      follower: {
        select: {
          id: true, full_name: true, role: true, profile_photo_url: true,
          bio: true, country: true, city: true,
          verification_status: true, verification_badges: true
        }
      }
    }
  });
  return { items: follows.map((f) => f.follower), next_cursor: null };
}

export async function listFollowing(userId: string, limit = 50) {
  const follows = await prisma.follow.findMany({
    where: { follower_id: userId },
    orderBy: { created_at: "desc" },
    take: limit,
    include: {
      followee: {
        select: {
          id: true, full_name: true, role: true, profile_photo_url: true,
          bio: true, country: true, city: true,
          verification_status: true, verification_badges: true
        }
      }
    }
  });
  return { items: follows.map((f) => f.followee), next_cursor: null };
}
