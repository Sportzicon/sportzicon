import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { slugify } from "../../utils/ids";
import { extractPlainText } from "../../utils/richText";
import { eventBus } from "../../lib/EventBus";
import { CONTENT_LIKED, type ContentLikedEvent } from "../../events/types";
import type { CreateContentInput, ListContentInput, UpdateContentInput } from "./content.schemas";

const AUTHOR_SELECT = { id: true, full_name: true, role: true, profile_photo_url: true };
const DETAIL_INCLUDE = { postDetail: true, blogDetail: true, reelDetail: true } as const;

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.blogDetail.findUnique({ where: { slug: candidate }, select: { content_id: true } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createContent(authorId: string, input: CreateContentInput) {
  if (input.content_type === "post") {
    const content = await prisma.content.create({
      data: {
        author_id: authorId,
        content_type: "post",
        sport: input.sport,
        tags: input.tags ?? [],
        postDetail: {
          create: {
            type: input.type,
            content_json: input.content_json as Prisma.InputJsonValue,
            text_excerpt: extractPlainText(input.content_json),
            media: (input.media ?? []) as Prisma.InputJsonValue,
          },
        },
      },
      include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT } },
    });
    return flattenContent(content);
  }

  if (input.content_type === "blog") {
    const slug = await uniqueSlug(input.title);
    const isPublished = input.status === "published";
    const cover = input.cover_image_url === "" ? undefined : input.cover_image_url;

    const content = await prisma.content.create({
      data: {
        author_id: authorId,
        content_type: "blog",
        sport: input.sport,
        tags: input.tags ?? [],
        blogDetail: {
          create: {
            title: input.title,
            slug,
            cover_image_url: cover,
            excerpt: input.excerpt ?? input.body_markdown.replace(/[#*`>_\-[\]!]/g, "").slice(0, 240),
            body_markdown: input.body_markdown,
            status: isPublished ? "published" : "draft",
            published_at: isPublished ? new Date() : undefined,
          },
        },
      },
      include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT } },
    });
    return flattenContent(content);
  }

  // reel
  const content = await prisma.content.create({
    data: {
      author_id: authorId,
      content_type: "reel",
      sport: input.sport,
      reelDetail: {
        create: {
          title: input.title,
          description: input.description,
          video_url: input.video_url,
          thumbnail_url: input.thumbnail_url,
          duration_seconds: input.duration_seconds,
        },
      },
    },
    include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT } },
  });
  return flattenContent(content);
}

export async function updateContent(
  id: string,
  actorId: string,
  isAdmin: boolean,
  input: UpdateContentInput
) {
  const content = await prisma.content.findUnique({ where: { id }, select: { author_id: true, content_type: true } });
  if (!content) throw NotFound("Content not found");
  if (content.author_id !== actorId && !isAdmin) throw Forbidden(`Cannot edit another user's ${content.content_type}`);
  if (content.content_type !== input.content_type) throw BadRequest("content_type mismatch");

  if (input.content_type === "post") {
    const detailData: Record<string, unknown> = {};
    if (input.content_json !== undefined) {
      detailData.content_json = input.content_json as Prisma.InputJsonValue;
      detailData.text_excerpt = extractPlainText(input.content_json);
    }
    if (input.media !== undefined) detailData.media = input.media as Prisma.InputJsonValue;

    const ops = [];
    if (input.tags !== undefined) ops.push(prisma.content.update({ where: { id }, data: { tags: input.tags } }));
    if (Object.keys(detailData).length) ops.push(prisma.postDetail.update({ where: { content_id: id }, data: detailData }));
    if (ops.length) await prisma.$transaction(ops);
    return { ok: true };
  }

  if (input.content_type === "blog") {
    const blog = await prisma.blogDetail.findUnique({ where: { content_id: id }, select: { status: true } });
    const detailData: Record<string, unknown> = {};
    if (input.title !== undefined) detailData.title = input.title;
    if (input.body_markdown !== undefined) detailData.body_markdown = input.body_markdown;
    if (input.excerpt !== undefined) detailData.excerpt = input.excerpt;
    if (input.cover_image_url !== undefined) detailData.cover_image_url = input.cover_image_url === "" ? null : input.cover_image_url;
    if (input.status !== undefined) {
      if (input.status === "published" && blog?.status !== "published") detailData.published_at = new Date();
      detailData.status = input.status;
    }

    const contentData: Record<string, unknown> = {};
    if (input.tags !== undefined) contentData.tags = input.tags;
    if (input.sport !== undefined) contentData.sport = input.sport;

    const ops = [];
    if (Object.keys(contentData).length) ops.push(prisma.content.update({ where: { id }, data: contentData }));
    if (Object.keys(detailData).length) ops.push(prisma.blogDetail.update({ where: { content_id: id }, data: detailData }));
    if (ops.length) await prisma.$transaction(ops);
    return { ok: true };
  }

  // reel
  const detailData: Record<string, unknown> = {};
  if (input.title !== undefined) detailData.title = input.title;
  if (input.description !== undefined) detailData.description = input.description;

  const ops = [];
  if (input.sport !== undefined) ops.push(prisma.content.update({ where: { id }, data: { sport: input.sport } }));
  if (Object.keys(detailData).length) ops.push(prisma.reelDetail.update({ where: { content_id: id }, data: detailData }));
  if (ops.length) await prisma.$transaction(ops);
  return { ok: true };
}

export async function deleteContent(id: string, actorId: string, isAdmin: boolean) {
  const content = await prisma.content.findUnique({ where: { id }, select: { author_id: true, content_type: true } });
  if (!content) throw NotFound("Content not found");
  if (content.author_id !== actorId && !isAdmin) throw Forbidden(`Cannot delete another user's ${content.content_type}`);
  await prisma.content.delete({ where: { id } });
  return { ok: true };
}

export async function listContent(q: ListContentInput, actor?: { id: string; role: string }) {
  const limit = q.limit ?? (q.content_type === "reel" ? 10 : 20);
  const where: Record<string, unknown> = {};
  if (q.content_type) where.content_type = q.content_type;
  if (q.author_id) where.author_id = q.author_id;
  if (q.sport) where.sport = { contains: q.sport, mode: "insensitive" };
  if (q.content_type === "post" && q.type) where.postDetail = { type: q.type };

  const isAdmin = actor?.role === "admin";
  const isOwnerViewingSelf = !!(actor && q.author_id && q.author_id === actor.id);

  if (q.content_type === "blog") {
    const blogWhere: Record<string, unknown> = {};
    if (isAdmin || isOwnerViewingSelf) {
      if (q.status) blogWhere.status = q.status;
    } else {
      blogWhere.status = "published";
    }
    if (q.q) {
      blogWhere.OR = [
        { title: { contains: q.q, mode: "insensitive" } },
        { excerpt: { contains: q.q, mode: "insensitive" } },
        { body_markdown: { contains: q.q, mode: "insensitive" } },
      ];
    }
    where.blogDetail = blogWhere;
    if (q.tag) where.tags = { has: q.tag };
  } else if (!q.content_type && !(isAdmin || isOwnerViewingSelf)) {
    // Mixed-type listing (e.g. a profile's activity feed): hide draft blogs
    // from anyone but the author/admin; posts/reels are unrestricted.
    where.OR = [
      { content_type: { in: ["post", "reel"] } },
      { content_type: "blog", blogDetail: { status: "published" } },
    ];
  }

  const rows = await prisma.content.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT }, _count: { select: { likes: true, comments: true } } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const items = page.map(flattenContent);
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function getFeedForUser(userId: string, limit = 20, cursor?: string) {
  const followeeIds = await prisma.follow
    .findMany({ where: { follower_id: userId }, select: { followee_id: true } })
    .then((rows) => rows.map((r) => r.followee_id));

  const authorIds = [userId, ...followeeIds];

  // Mixed post/reel/blog feed — only the viewer's own draft blogs are
  // visible; followees' drafts are hidden, same rule as listContent()'s
  // mixed-type branch.
  const rows = await prisma.content.findMany({
    where: {
      author_id: { in: authorIds },
      OR: [
        { content_type: { in: ["post", "reel"] } },
        { content_type: "blog", blogDetail: { status: "published" } },
        { content_type: "blog", author_id: userId },
      ],
    },
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT }, _count: { select: { likes: true, comments: true } } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const data = page.map(flattenContent);
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}

export async function getContentByIdOrSlug(idOrSlug: string, opts: { userId?: string } = {}) {
  const content = await prisma.content.findFirst({
    where: { OR: [{ id: idOrSlug }, { blogDetail: { slug: idOrSlug } }] },
    include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT }, _count: { select: { likes: true, comments: true } } },
  });
  if (!content) throw NotFound("Content not found");

  const flattened = flattenContent(content);
  if (content.content_type === "blog" && opts.userId) {
    flattened.liked = await checkLiked(content.id, opts.userId);
  }
  return flattened;
}

export async function likeContent(id: string, userId: string) {
  const content = await prisma.content.findUnique({ where: { id }, select: { id: true, author_id: true, content_type: true } });
  if (!content) throw NotFound("Content not found");

  const [, countResult] = await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "ContentLike" (content_id, user_id) VALUES (${id}::uuid, ${userId}::uuid) ON CONFLICT DO NOTHING`,
    prisma.$queryRaw<[{ like_count: bigint }]>`
      UPDATE "Content" SET like_count = (SELECT COUNT(*) FROM "ContentLike" WHERE content_id = ${id}::uuid)
      WHERE id = ${id}::uuid RETURNING like_count`,
  ]);

  if (content.author_id !== userId) {
    prisma.user.findUnique({ where: { id: userId }, select: { full_name: true } })
      .then((actor) => {
        eventBus.emit<ContentLikedEvent>(CONTENT_LIKED, {
          contentId: id,
          contentType: content.content_type as ContentLikedEvent["contentType"],
          actorId: userId,
          actorName: actor?.full_name ?? "Someone",
          authorId: content.author_id,
        });
      })
      .catch(() => undefined);
  }

  return { like_count: Number((countResult as any)[0]?.like_count ?? 0), liked: true };
}

export async function unlikeContent(id: string, userId: string) {
  const exists = await prisma.content.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw NotFound("Content not found");

  const [, countResult] = await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "ContentLike" WHERE content_id = ${id}::uuid AND user_id = ${userId}::uuid`,
    prisma.$queryRaw<[{ like_count: bigint }]>`
      UPDATE "Content" SET like_count = (SELECT COUNT(*) FROM "ContentLike" WHERE content_id = ${id}::uuid)
      WHERE id = ${id}::uuid RETURNING like_count`,
  ]);

  return { like_count: Number((countResult as any)[0]?.like_count ?? 0), liked: false };
}

export async function checkLiked(id: string, userId: string): Promise<boolean> {
  const row = await prisma.contentLike.findUnique({
    where: { content_id_user_id: { content_id: id, user_id: userId } },
    select: { content_id: true },
  });
  return !!row;
}

// ── Internal helper ───────────────────────────────────────────────────────────

function flattenContent(row: any) {
  const { author, postDetail, blogDetail, reelDetail, created_at, updated_at, _count, ...rest } = row;
  const detail = postDetail ?? blogDetail ?? reelDetail ?? {};
  const { content_id: _contentId, published_at, ...detailRest } = detail;

  return {
    ...rest,
    ...detailRest,
    author,
    author_name: author?.full_name ?? "Unknown",
    author_role: author?.role,
    like_count: _count?.likes ?? rest.like_count,
    comment_count: _count?.comments ?? rest.comment_count,
    published_at: published_at instanceof Date ? published_at.getTime() : published_at,
    created_at: created_at instanceof Date ? created_at.getTime() : created_at,
    updated_at: updated_at instanceof Date ? updated_at.getTime() : updated_at,
  };
}
