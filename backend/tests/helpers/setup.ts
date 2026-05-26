import { db } from "../../src/config/firestore";

// Wipe every doc in every collection between tests. Safe only against the emulator.
const COLLECTIONS = [
  "users",
  "organizations",
  "opportunities",
  "applications",
  "conversations",
  "messages",
  "notifications",
  "verifications",
  "reports",
  "follows",
  "posts",
  "reels",
  "blogs",
  "comments",
  "audit_logs",
  "email_verifications",
  "password_resets",
  "refresh_tokens"
];

export async function resetFirestore() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Refusing to wipe Firestore - emulator not configured");
  }
  await Promise.all(
    COLLECTIONS.map(async (c) => {
      const snap = await db.collection(c).limit(500).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) await batch.commit();
    })
  );
}
