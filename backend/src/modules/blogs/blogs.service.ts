import { prisma } from "../../config/prisma";
import { Forbidden, NotFound } from "../../utils/errors";
import { slugify } from "../../utils/ids";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "post";
  for (let i = 0; i < 6; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const existing = await prisma.blog.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createBlog(authorId: string, input: Record<string, unknown>) {
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw NotFound("Author not found");

  const slug = await uniqueSlug(input.title as string);
  const isPublished = input.status === "published";

  return prisma.blog.create({
    data: {
      author_id: authorId,
      title: input.title as string,
      slug,
      cover_image_url: input.cover_image_url as string | undefined,
      excerpt: (input.excerpt as string) ?? (input.body_markdown as string).replace(/[#*`>_-]/g, "").slice(0, 240),
      body_markdown: input.body_markdown as string,
      tags: (input.tags as string[]) ?? [],
      sport: input.sport as string | undefined,
      status: isPublished ? "published" : "draft",
      published_at: isPublished ? new Date() : undefined
    }
  });
}

export async function updateBlog(id: string, actorId: string, isAdmin: boolean, patch: Record<string, unknown>) {
  const blog = await prisma.blog.findUnique({ where: { id } });
  if (!blog) throw NotFound("Blog not found");
  if (blog.author_id !== actorId && !isAdmin) throw Forbidden("Cannot edit another user's blog");

  const data: Record<string, unknown> = {};
  if (patch.title) {
    data.title = patch.title;
  }
  for (const k of ["body_markdown", "excerpt", "cover_image_url", "tags", "sport"]) {
    if (patch[k] !== undefined) data[k] = patch[k];
  }
  if (patch.status) {
    if (patch.status === "published" && blog.status !== "published") data.published_at = new Date();
    data.status = patch.status;
  }

  return prisma.blog.update({ where: { id }, data });
}

export async function deleteBlog(id: string, actorId: string, isAdmin: boolean) {
  const blog = await prisma.blog.findUnique({ where: { id }, select: { author_id: true } });
  if (!blog) throw NotFound("Blog not found");
  if (blog.author_id !== actorId && !isAdmin) throw Forbidden("Cannot delete another user's blog");
  await prisma.blog.delete({ where: { id } });
  return { ok: true };
}

export async function listBlogs(q: {
  author_id?: string;
  tag?: string;
  sport?: string;
  status?: string;
  limit: number;
  cursor?: string;
}) {
  const where: Record<string, unknown> = { status: q.status ?? "published" };
  if (q.author_id) where.author_id = q.author_id;
  if (q.sport) where.sport = q.sport;
  if (q.tag) where.tags = { has: q.tag };

  const items = await prisma.blog.findMany({
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

export async function getBlog(idOrSlug: string) {
  const blog = await prisma.blog.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: { author: { select: { id: true, full_name: true, profile_photo_url: true } } }
  });
  if (!blog) throw NotFound("Blog not found");
  // Fire-and-forget view count increment
  prisma.blog.update({ where: { id: blog.id }, data: { view_count: { increment: 1 } } }).catch(() => undefined);
  return { ...blog, view_count: blog.view_count + 1 };
}

export async function likeBlog(id: string, userId: string) {
  const exists = await prisma.blog.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw NotFound("Blog not found");

  const already = await prisma.blogLike.findUnique({
    where: { blog_id_user_id: { blog_id: id, user_id: userId } },
    select: { blog_id: true }
  });
  if (already) return { ok: true };

  await prisma.$transaction([
    prisma.blogLike.create({ data: { blog_id: id, user_id: userId } }),
    prisma.blog.update({ where: { id }, data: { like_count: { increment: 1 } } })
  ]);
  return { ok: true };
}

export async function unlikeBlog(id: string, userId: string) {
  const already = await prisma.blogLike.findUnique({
    where: { blog_id_user_id: { blog_id: id, user_id: userId } },
    select: { blog_id: true }
  });
  if (!already) return { ok: true };

  await prisma.$transaction([
    prisma.blogLike.delete({ where: { blog_id_user_id: { blog_id: id, user_id: userId } } }),
    prisma.blog.update({ where: { id }, data: { like_count: { decrement: 1 } } })
  ]);
  return { ok: true };
}
