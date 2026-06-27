-- Rename ban fields to suspension fields on User table
ALTER TABLE "User" RENAME COLUMN "is_banned" TO "is_suspended";
ALTER TABLE "User" RENAME COLUMN "banned_reason" TO "suspension_reason";
ALTER TABLE "User" RENAME COLUMN "banned_at" TO "suspended_at";
