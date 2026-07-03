-- Remove denormalized/static counter columns.
-- Follower/following counts are now computed live from the "Follow" table
-- (see users.service.ts getUserById, search.service.ts searchPlayers).
-- View counts are removed entirely per product decision.
ALTER TABLE "User" DROP COLUMN "follower_count";
ALTER TABLE "User" DROP COLUMN "following_count";
ALTER TABLE "Reel" DROP COLUMN "view_count";
ALTER TABLE "Blog" DROP COLUMN "view_count";
