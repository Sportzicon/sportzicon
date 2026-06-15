import mimeTypes from "mime-types";
import { prisma } from "../../config/prisma";
import { env, usingGcsEmulator } from "../../config/env";
import { docsBucket, mediaBucket } from "../../config/storage";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { newId } from "../../utils/ids";
import {
  type UploadContext,
  ALLOWED_TYPES_BY_CONTEXT,
  MAX_SIZE_MB_BY_CONTEXT,
  PRIVATE_CONTEXTS,
} from "./media.schemas";

function bucketFor(context: UploadContext) {
  return PRIVATE_CONTEXTS.has(context) ? docsBucket : mediaBucket;
}

function publicUrlFor(bucketName: string, objectName: string): string {
  if (usingGcsEmulator) {
    const base = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") ?? "";
    return `${base}/${bucketName}/${objectName}`;
  }
  return `https://storage.googleapis.com/${bucketName}/${objectName}`;
}

export async function getUploadUrl(input: {
  userId: string;
  context: UploadContext;
  fileName: string;
  contentType: string;
}) {
  const allowed = ALLOWED_TYPES_BY_CONTEXT[input.context];
  if (!allowed?.includes(input.contentType)) {
    throw BadRequest(
      `File type "${input.contentType}" is not allowed for context "${input.context}". ` +
        `Allowed: ${allowed?.join(", ")}`,
    );
  }

  const maxBytes = MAX_SIZE_MB_BY_CONTEXT[input.context] * 1024 * 1024;
  const ext = mimeTypes.extension(input.contentType) || "bin";

  // Sanitise: strip path components the client might sneak in
  const safeName = input.fileName.replace(/[/\\]/g, "_").replace(/\.\./g, "_");
  const objectName = `${input.userId}/${input.context}/${Date.now()}-${newId()}-${safeName}.${ext}`;
  const bucket = bucketFor(input.context);
  const file = bucket.file(objectName);
  const isPrivate = PRIVATE_CONTEXTS.has(input.context);

  if (usingGcsEmulator) {
    const clientUrl = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") ?? "";
    return {
      method: "PUT" as const,
      upload_url: `${clientUrl}/b/${bucket.name}/o/${encodeURIComponent(objectName)}`,
      headers: { "Content-Type": input.contentType },
      object_name: objectName,
      public_url: isPrivate ? undefined : `${clientUrl}/${bucket.name}/${objectName}`,
    };
  }

  const expires = Date.now() + env.GCS_SIGNED_URL_TTL_MIN * 60 * 1000;
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires,
    contentType: input.contentType,
    // Enforce max size server-side: client cannot upload beyond this
    extensionHeaders: { "x-goog-content-length-range": `0,${maxBytes}` },
  });

  return {
    method: "PUT" as const,
    upload_url: uploadUrl,
    headers: {
      "Content-Type": input.contentType,
      "x-goog-content-length-range": `0,${maxBytes}`,
    },
    object_name: objectName,
    public_url: isPrivate ? undefined : publicUrlFor(bucket.name, objectName),
  };
}

export async function confirmUpload(key: string, context: UploadContext): Promise<{ url: string | null }> {
  const bucket = bucketFor(context);
  const [exists] = await bucket.file(key).exists();
  if (!exists) throw BadRequest("Upload not found or incomplete — please retry the upload.");

  const isPrivate = PRIVATE_CONTEXTS.has(context);
  return {
    url: isPrivate ? null : publicUrlFor(bucket.name, key),
  };
}

export async function getPrivateDownloadUrl(key: string, userId: string, userRole: string): Promise<string> {
  // Resolve which org owns this document key
  const doc = await prisma.orgDocument.findFirst({
    where: { key },
    include: { organization: { select: { owner_user_id: true } } },
  });
  if (!doc) throw NotFound("Document not found.");
  if (doc.organization.owner_user_id !== userId && userRole !== "admin") {
    throw Forbidden("You do not have permission to download this document.");
  }

  if (usingGcsEmulator) {
    const base = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") ?? "";
    return `${base}/${docsBucket.name}/${key}`;
  }

  const expires = Date.now() + env.GCS_SIGNED_URL_TTL_MIN * 60 * 1000;
  const [url] = await docsBucket.file(key).getSignedUrl({ version: "v4", action: "read", expires });
  return url;
}

// Legacy direct-upload path used by server-side test helpers; kept for backward compat.
export async function uploadFile(input: {
  userId: string;
  category: "image" | "video" | "document";
  filename: string;
  contentType: string;
  buffer: Buffer;
}) {
  const legacyCtxMap: Record<string, UploadContext> = {
    image: "post",
    video: "reel",
    document: "org-doc",
  };
  const context = legacyCtxMap[input.category] ?? "post";
  const allowed = ALLOWED_TYPES_BY_CONTEXT[context];
  if (!allowed.includes(input.contentType)) {
    throw BadRequest(`MIME type ${input.contentType} not allowed`);
  }

  const maxBytes = MAX_SIZE_MB_BY_CONTEXT[context] * 1024 * 1024;
  if (input.buffer.length > maxBytes) {
    throw BadRequest(`File size must be <= ${MAX_SIZE_MB_BY_CONTEXT[context]}MB`);
  }

  const ext = mimeTypes.extension(input.contentType) || "bin";
  const objectName = `${input.userId}/${context}/${Date.now()}-${newId()}.${ext}`;
  const bucket = bucketFor(context);
  await bucket.file(objectName).save(input.buffer, { contentType: input.contentType });

  if (PRIVATE_CONTEXTS.has(context)) return undefined;
  return publicUrlFor(bucket.name, objectName);
}
