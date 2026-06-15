import { z } from "zod";

export const UPLOAD_CONTEXTS = [
  "avatar",
  "post",
  "reel",
  "blog-cover",
  "org-logo",
  "org-doc",
] as const;

export type UploadContext = (typeof UPLOAD_CONTEXTS)[number];

/** Max file size in MB per upload context — enforced server-side via signed URL conditions. */
export const MAX_SIZE_MB_BY_CONTEXT: Record<UploadContext, number> = {
  avatar: 5,
  post: 10,
  "blog-cover": 10,
  "org-logo": 10,
  reel: 200,
  "org-doc": 20,
};

/** Allowed MIME types per context — enforced server-side before issuing signed URL. */
export const ALLOWED_TYPES_BY_CONTEXT: Record<UploadContext, string[]> = {
  avatar:       ["image/jpeg", "image/png", "image/webp", "image/gif"],
  post:         ["image/jpeg", "image/png", "image/webp", "image/gif"],
  "blog-cover": ["image/jpeg", "image/png", "image/webp"],
  "org-logo":   ["image/jpeg", "image/png", "image/webp"],
  reel:         ["video/mp4", "video/webm", "video/quicktime"],
  "org-doc":    ["application/pdf"],
};

/** Contexts that store in the private docs bucket (not publicly readable). */
export const PRIVATE_CONTEXTS: Set<UploadContext> = new Set(["org-doc"]);

export const uploadUrlSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255, "Filename must be 255 characters or less")
    .refine((fn) => !/[/\\]|\.\./.test(fn), "Invalid filename: cannot contain /, \\, or .."),
  contentType: z.string().min(3),
  context: z.enum(UPLOAD_CONTEXTS),
});

export const confirmUploadSchema = z.object({
  key: z.string().min(1).max(500),
  context: z.enum(UPLOAD_CONTEXTS),
});
