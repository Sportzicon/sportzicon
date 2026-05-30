// Clears all data from every table while preserving the schema.
// Useful for resetting local dev state without re-running migrations.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Truncating all tables…");

  // Delete in reverse dependency order to respect FK constraints
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.blogLike.deleteMany();
  await prisma.reelLike.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.blog.deleteMany();
  await prisma.reel.deleteMany();
  await prisma.post.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.application.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.emailVerification.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ All tables truncated.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Truncate failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
