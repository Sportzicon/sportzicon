import mimeTypes from "mime-types";
import { env, usingGcsEmulator } from "../../config/env";
import { docsBucket, mediaBucket } from "../../config/storage";
import { BadRequest } from "../../utils/errors";
import { newId } from "../../utils/ids";

// Whitelist of MIME types we accept by category. Server-enforced; never trust client claims.
const ALLOWED: Record<string, string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: ["application/pdf"]
};

export type UploadCategory = "image" | "video" | "document";

const isPrivate = (cat: UploadCategory) => cat === "document";

export async function getUploadUrl(input: {
  userId: string;
  category: UploadCategory;
  filename: string;
  contentType: string;
  contentLength: number;
}) {
  if (!ALLOWED[input.category]) throw BadRequest("Unsupported category");
  if (!ALLOWED[input.category].includes(input.contentType))
    throw BadRequest(`MIME type ${input.contentType} not allowed for ${input.category}`);
  if (input.contentLength <= 0 || input.contentLength > env.MAX_UPLOAD_MB * 1024 * 1024)
    throw BadRequest(`File size must be <= ${env.MAX_UPLOAD_MB}MB`);

  const ext = mimeTypes.extension(input.contentType) || "bin";
  const objectName = `${input.userId}/${input.category}s/${Date.now()}-${newId()}.${ext}`;
  const bucket = isPrivate(input.category) ? docsBucket : mediaBucket;
  const file = bucket.file(objectName);

  if (usingGcsEmulator) {
    // fake-gcs-server supports direct PUT to /b/{bucket}/o/{object} endpoint
    // Replace internal 'gcs' hostname with 'localhost' for browser access
    const clientUrl = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") || "";
    return {
      method: "PUT" as const,
      upload_url: `${clientUrl}/b/${bucket.name}/o/${encodeURIComponent(objectName)}`,
      headers: {
        "Content-Type": input.contentType
      },
      object_name: objectName,
      public_url: isPrivate(input.category)
        ? undefined
        : `${clientUrl}/${bucket.name}/${objectName}`
    };
  }

  const expires = Date.now() + env.GCS_SIGNED_URL_TTL_MIN * 60 * 1000;
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires,
    contentType: input.contentType,
    extensionHeaders: { "x-goog-content-length-range": `0,${env.MAX_UPLOAD_MB * 1024 * 1024}` }
  });

  return {
    method: "PUT" as const,
    upload_url: uploadUrl,
    headers: {
      "Content-Type": input.contentType,
      "x-goog-content-length-range": `0,${env.MAX_UPLOAD_MB * 1024 * 1024}`
    },
    object_name: objectName,
    // Public media is read directly; private docs get a fresh signed read URL each request.
    public_url: isPrivate(input.category)
      ? undefined
      : `https://storage.googleapis.com/${bucket.name}/${objectName}`
  };
}

export async function getReadUrl(category: UploadCategory, objectName: string) {
  const bucket = isPrivate(category) ? docsBucket : mediaBucket;
  if (usingGcsEmulator) {
    const clientUrl = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") || "";
    return `${clientUrl}/${bucket.name}/${objectName}`;
  }
  const expires = Date.now() + env.GCS_SIGNED_URL_TTL_MIN * 60 * 1000;
  const [url] = await bucket.file(objectName).getSignedUrl({ version: "v4", action: "read", expires });
  return url;
}

export async function uploadFile(input: {
  userId: string;
  category: UploadCategory;
  filename: string;
  contentType: string;
  buffer: Buffer;
}) {
  if (!ALLOWED[input.category]) throw BadRequest("Unsupported category");
  if (!ALLOWED[input.category].includes(input.contentType))
    throw BadRequest(`MIME type ${input.contentType} not allowed for ${input.category}`);
  if (input.buffer.length <= 0 || input.buffer.length > env.MAX_UPLOAD_MB * 1024 * 1024)
    throw BadRequest(`File size must be <= ${env.MAX_UPLOAD_MB}MB`);

  const ext = mimeTypes.extension(input.contentType) || "bin";
  const objectName = `${input.userId}/${input.category}s/${Date.now()}-${newId()}.${ext}`;
  const bucket = isPrivate(input.category) ? docsBucket : mediaBucket;
  const file = bucket.file(objectName);

  await file.save(input.buffer, { contentType: input.contentType });

  if (isPrivate(input.category)) return undefined;
  const clientUrl = usingGcsEmulator ? env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") || "" : "https://storage.googleapis.com";
  return `${clientUrl}/${bucket.name}/${objectName}`;
}
