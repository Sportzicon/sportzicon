import { Firestore } from "@google-cloud/firestore";
import { env, usingFirestoreEmulator } from "./env";
import { logger } from "./logger";

// The @google-cloud/firestore SDK reads FIRESTORE_EMULATOR_HOST automatically.
// When set, no credentials are needed.
export const db = new Firestore({
  projectId: env.GCP_PROJECT_ID,
  ignoreUndefinedProperties: true
});

if (usingFirestoreEmulator) {
  logger.info({ host: env.FIRESTORE_EMULATOR_HOST }, "Firestore emulator in use");
}

// Centralised collection name constants — keep all literal strings in one place.
export const Collections = {
  users: "users",
  organizations: "organizations",
  opportunities: "opportunities",
  applications: "applications",
  conversations: "conversations",
  messages: "messages",
  notifications: "notifications",
  verifications: "verifications",
  reports: "reports",
  follows: "follows",
  posts: "posts",
  reels: "reels",
  blogs: "blogs",
  comments: "comments",
  auditLogs: "audit_logs",
  emailVerifications: "email_verifications",
  passwordResets: "password_resets",
  refreshTokens: "refresh_tokens"
} as const;
