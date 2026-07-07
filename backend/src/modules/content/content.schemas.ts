import { z } from "zod";

const tiptapDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.any()).default([]) })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= 20000, { message: "Content is too large" });

const postMediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
  thumbnail_url: z.string().url().optional(),
});

const postFields = {
  type: z.enum(["log", "post"]).default("post"),
  content_json: tiptapDocSchema,
  media: z.array(postMediaItemSchema).max(10).optional(),
  sport: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
};

const blogFields = {
  title: z.string().min(5, "Title must be at least 5 characters").max(200).trim(),
  body_markdown: z.string().min(100, "Content must be at least 100 characters").max(50000),
  excerpt: z.string().max(280).optional(),
  cover_image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  sport: z.string().max(60).optional(),
  status: z.enum(["draft", "published"]).default("draft"),
};

const reelFields = {
  title: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  video_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  duration_seconds: z.number().int().positive().max(180).optional(),
  sport: z.string().max(60).optional(),
};

export const createContentSchema = z.discriminatedUnion("content_type", [
  z.object({ content_type: z.literal("post"), ...postFields }),
  z.object({ content_type: z.literal("blog"), ...blogFields }),
  z.object({ content_type: z.literal("reel"), ...reelFields }),
]);

export const updateContentSchema = z.discriminatedUnion("content_type", [
  z.object({
    content_type: z.literal("post"),
    content_json: tiptapDocSchema.optional(),
    media: z.array(postMediaItemSchema).max(10).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  }),
  z.object({
    content_type: z.literal("blog"),
    title: z.string().min(5).max(200).trim().optional(),
    body_markdown: z.string().min(100).max(50000).optional(),
    excerpt: z.string().max(280).optional(),
    cover_image_url: z.string().url().optional().or(z.literal("")),
    tags: z.array(z.string().max(30)).max(10).optional(),
    sport: z.string().max(60).optional(),
    status: z.enum(["draft", "published"]).optional(),
  }),
  z.object({
    content_type: z.literal("reel"),
    title: z.string().min(1).max(100).trim().optional(),
    description: z.string().max(500).optional(),
    sport: z.string().max(60).optional(),
  }),
]);

export const listContentSchema = z.object({
  content_type: z.enum(["post", "blog", "reel"]).optional(),
  author_id: z.string().optional(),
  sport: z.string().optional(),
  type: z.enum(["log", "post"]).optional(),
  tag: z.string().optional(),
  q: z.string().max(200).optional(),
  status: z.enum(["draft", "published"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type ListContentInput = z.infer<typeof listContentSchema>;
