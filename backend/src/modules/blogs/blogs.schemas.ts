import { z } from "zod";

export const createBlogSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200).trim(),
  body_markdown: z.string().min(100, "Content must be at least 100 characters").max(50000),
  excerpt: z.string().max(280).optional(),
  cover_image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  sport: z.string().max(60).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const updateBlogSchema = createBlogSchema.partial();

export const listBlogsSchema = z.object({
  author_id: z.string().optional(),
  tag: z.string().optional(),
  sport: z.string().optional(),
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "published"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
export type ListBlogsInput = z.infer<typeof listBlogsSchema>;
