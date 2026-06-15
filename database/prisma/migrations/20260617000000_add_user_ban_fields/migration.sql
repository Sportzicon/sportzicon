-- AlterTable: add ban fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_banned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned_reason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "banned_at" TIMESTAMP(3);
