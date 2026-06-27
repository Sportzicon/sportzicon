-- AlterTable
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "team1_playing_level" TEXT;
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "team2_playing_level" TEXT;
