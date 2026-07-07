import { prisma } from "../../src/config/prisma";

// Truncates all tables between tests. Safe only against a test database.
export async function resetDatabase() {
  if (!process.env.DATABASE_URL?.includes("localhost") && !process.env.DATABASE_URL?.includes("test")) {
    throw new Error("Refusing to truncate — DATABASE_URL does not look like a local/test database");
  }
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.contentLike.deleteMany();
  await prisma.content.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.application.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
}
