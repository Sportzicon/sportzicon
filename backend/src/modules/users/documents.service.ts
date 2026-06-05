import { prisma } from "../../config/prisma";
import { docsBucket } from "../../config/storage";
import { usingGcsEmulator } from "../../config/env";
import { env } from "../../config/env";
import { newId } from "../../utils/ids";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import mimeTypes from "mime-types";

const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export async function listDocuments(userId: string) {
  const docs = await prisma.userDocument.findMany({
    where: { user_id: userId },
    orderBy: { created_at: "desc" },
  });

  return Promise.all(
    docs.map(async (doc) => ({
      id: doc.id,
      type: doc.type,
      file_name: doc.file_name,
      size_bytes: doc.size_bytes,
      created_at: doc.created_at,
      url: await getDocUrl(doc.url),
    }))
  );
}

export async function uploadDocument(input: {
  userId: string;
  type: string;
  file: Express.Multer.File;
}) {
  const { userId, type, file } = input;

  if (!ALLOWED_MIME.includes(file.mimetype))
    throw BadRequest(`File type ${file.mimetype} not allowed. Use PDF, JPG, PNG, or DOCX.`);

  if (file.size > MAX_SIZE)
    throw BadRequest(`File too large. Maximum size is 5 MB.`);

  const ext = mimeTypes.extension(file.mimetype) || "bin";
  const objectName = `${userId}/documents/${Date.now()}-${newId()}.${ext}`;
  const gcsFile = docsBucket.file(objectName);

  await gcsFile.save(file.buffer, { contentType: file.mimetype });

  const doc = await prisma.userDocument.create({
    data: {
      id: newId(),
      user_id: userId,
      type,
      file_name: file.originalname,
      url: objectName,
      size_bytes: file.size,
    },
  });

  return {
    id: doc.id,
    type: doc.type,
    file_name: doc.file_name,
    size_bytes: doc.size_bytes,
    created_at: doc.created_at,
    url: await getDocUrl(doc.url),
  };
}

export async function deleteDocument(userId: string, docId: string) {
  const doc = await prisma.userDocument.findUnique({ where: { id: docId } });
  if (!doc) throw NotFound("Document not found");
  if (doc.user_id !== userId) throw Forbidden("Not your document");

  await docsBucket.file(doc.url).delete({ ignoreNotFound: true });
  await prisma.userDocument.delete({ where: { id: docId } });
}

async function getDocUrl(objectName: string): Promise<string> {
  if (usingGcsEmulator) {
    const base = env.STORAGE_EMULATOR_HOST?.replace("gcs:", "localhost:") || "";
    return `${base}/${docsBucket.name}/${objectName}`;
  }
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour signed URL
  const [url] = await docsBucket.file(objectName).getSignedUrl({
    version: "v4",
    action: "read",
    expires,
  });
  return url;
}
