import { Storage } from "@google-cloud/storage";
import { env, usingGcsEmulator } from "./env";
import { logger } from "./logger";

const storageOpts: ConstructorParameters<typeof Storage>[0] = {
  projectId: env.GCP_PROJECT_ID
};

if (usingGcsEmulator) {
  // fake-gcs-server speaks the GCS JSON API
  storageOpts.apiEndpoint = env.STORAGE_EMULATOR_HOST;
  logger.info({ host: env.STORAGE_EMULATOR_HOST }, "GCS emulator in use");
}

export const storage = new Storage(storageOpts);

export const mediaBucket = storage.bucket(env.GCS_BUCKET_MEDIA);
export const docsBucket = storage.bucket(env.GCS_BUCKET_DOCS);

export async function ensureBuckets() {
  // Create buckets in dev / emulator if they don't exist.
  for (const b of [mediaBucket, docsBucket]) {
    try {
      const [exists] = await b.exists();
      if (!exists) {
        await b.create().catch(() => undefined);
        logger.info({ bucket: b.name }, "created bucket");
      }
    } catch (err) {
      logger.warn({ err, bucket: b.name }, "bucket check failed (continuing)");
    }
  }
}
