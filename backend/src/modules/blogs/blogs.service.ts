import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";
import { slugify } from "../../utils/ids";
import type { CreateBlogInput, UpdateBlogInput, ListBlogsInput } from "./blogs.schemas";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.blog.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createBlog(authorId: string, input: CreateBlogInput) {
  const slug = await uniqueSlug(input.title);
  const isPublished = input.status === "published";

  const cover = input.cover_image_url === "" ? undefined : input.cover_image_url;

  return prisma.blog.create({
    data: {
      author_id: authorId,
      title: input.title,
      slug,
      cover_image_url: cover,
      excerpt: input.excerpt ?? input.body_markdown.replace(/[#*`>_\-\[\]!]/g, "").slice(0, 240),
      body_markdown: input.body_markdown,
      tags: input.tags ?? [],
      sport: input.sport,
      status: isPublished ? "published" : "draft",
      published_at: isPublished ? new Date() : undefined,
    },
  });
}

export async function updateBlog(
  id: string,
  actorId: string,
  isAdminRole: boolean,
  patch: UpdateBlogInput
) {
  const blog = await prisma.blog.findUnique({ where: { id } });
  if (!blog) throw NotFound("Blog not found");
  if (blog.author_id !== actorId && !isAdminRole) throw Forbidden("Cannot edit another user's blog");

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.body_markdown !== undefined) data.body_markdown = patch.body_markdown;
  if (patch.excerpt !== undefined) data.excerpt = patch.excerpt;
  if (patch.cover_image_url !== undefined) data.cover_image_url = patch.cover_image_url === "" ? null : patch.cover_image_url;
  if (patch.tags !== undefined) data.tags = patch.tags;
  if (patch.sport !== undefined) data.sport = patch.sport;
  if (patch.status !== undefined) {
    if (patch.status === "published" && blog.status !== "published") data.published_at = new Date();
    data.status = patch.status;
  }

  return prisma.blog.update({ where: { id }, data });
}

export async function deleteBlog(id: string, actorId: string, isAdminRole: boolean) {
  const blog = await prisma.blog.findUnique({ where: { id }, select: { author_id: true } });
  if (!blog) throw NotFound("Blog not found");
  if (blog.author_id !== actorId && !isAdminRole) throw Forbidden("Cannot delete another user's blog");
  await prisma.blog.delete({ where: { id } });
  return { ok: true };
}

export async function listBlogs(
  q: ListBlogsInput,
  actor?: { id: string; role: string }
) {
  const where: Record<string, unknown> = {};

  // Visibility: admin sees all; author sees own drafts; public sees published only
  if (actor?.role === "admin") {
    if (q.status) where.status = q.status;
    if (q.author_id) where.author_id = q.author_id;
  } else if (actor && q.author_id && q.author_id === actor.id) {
    // Author viewing own blogs — can see drafts
    where.author_id = actor.id;
    if (q.status) where.status = q.status;
  } else {
    // Public — published only
    where.status = "published";
    if (q.author_id) where.author_id = q.author_id;
  }

  if (q.sport) where.sport = { contains: q.sport, mode: "insensitive" };
  if (q.tag) where.tags = { has: q.tag };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: "insensitive" } },
      { excerpt: { contains: q.q, mode: "insensitive" } },
      { body_markdown: { contains: q.q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.blog.findMany({
    where,
    orderBy: { created_at: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, full_name: true, profile_photo_url: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const items = page.map(flattenBlog);
  return { items, next_cursor: hasMore ? items[items.length - 1].id : null };
}

export async function getBlog(idOrSlug: string) {
  const blog = await prisma.blog.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      author: { select: { id: true, full_name: true, profile_photo_url: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
  if (!blog) throw NotFound("Blog not found");

  // Atomic view count increment
  prisma.$executeRaw`UPDATE "Blog" SET view_count = view_count + 1 WHERE id = ${blog.id}`.catch(() => undefined);

  return { ...flattenBlog(blog), view_count: blog.view_count + 1 };
}

export async function likeBlog(id: string, userId: string) {
  const exists = await prisma.blog.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw NotFound("Blog not found");

  const already = await prisma.blogLike.findUnique({
    where: { blog_id_user_id: { blog_id: id, user_id: userId } },
    select: { blog_id: true },
  });
  if (already) return { ok: true, liked: true };

  await prisma.$transaction([
    prisma.$executeRaw`INSERT INTO "BlogLike" (blog_id, user_id) VALUES (${id}, ${userId}) ON CONFLICT DO NOTHING`,
    prisma.$executeRaw`UPDATE "Blog" SET like_count = (SELECT COUNT(*) FROM "BlogLike" WHERE blog_id = ${id}) WHERE id = ${id}`,
  ]);
  return { ok: true, liked: true };
}

export async function unlikeBlog(id: string, userId: string) {
  const already = await prisma.blogLike.findUnique({
    where: { blog_id_user_id: { blog_id: id, user_id: userId } },
    select: { blog_id: true },
  });
  if (!already) return { ok: true, liked: false };

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "BlogLike" WHERE blog_id = ${id} AND user_id = ${userId}`,
    prisma.$executeRaw`UPDATE "Blog" SET like_count = (SELECT COUNT(*) FROM "BlogLike" WHERE blog_id = ${id}) WHERE id = ${id}`,
  ]);
  return { ok: true, liked: false };
}

export async function checkLiked(id: string, userId: string): Promise<boolean> {
  const row = await prisma.blogLike.findUnique({
    where: { blog_id_user_id: { blog_id: id, user_id: userId } },
    select: { blog_id: true },
  });
  return !!row;
}

function flattenBlog(row: any) {
  const { author, created_at, updated_at, published_at, _count, ...rest } = row;
  return {
    ...rest,
    author,
    author_name: author?.full_name ?? "Unknown",
    like_count: _count?.likes ?? rest.like_count ?? 0,
    comment_count: _count?.comments ?? rest.comment_count ?? 0,
    created_at: created_at instanceof Date ? created_at.getTime() : created_at,
    updated_at: updated_at instanceof Date ? updated_at.getTime() : updated_at,
    published_at: published_at instanceof Date ? published_at.getTime() : published_at,
  };
}
