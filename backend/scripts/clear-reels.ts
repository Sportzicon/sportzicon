import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearReels() {
  console.log("🗑️  Clearing all reels...");

  try {
    const deleted = await prisma.reel.deleteMany({});
    console.log(`✅ Deleted ${deleted.count} reels`);

    console.log("🎉 All reels have been cleared!");
  } catch (error) {
    console.error("❌ Error clearing reels:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearReels();
