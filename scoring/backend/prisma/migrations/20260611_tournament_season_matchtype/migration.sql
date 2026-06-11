-- Add columns that exist in the Prisma schema but were never added via a migration.
-- The initial schema was applied with `prisma db push` in dev. Any fields added to the
-- schema AFTER that push are missing from production. All statements use IF NOT EXISTS
-- so this migration is safe to run repeatedly.

-- ── Tournament ────────────────────────────────────────────────────────────────
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "season"     TEXT,
  ADD COLUMN IF NOT EXISTS "match_type" TEXT;

-- ── Match ─────────────────────────────────────────────────────────────────────
-- match_type and match_data were added to the schema after the initial db push
ALTER TABLE "Match"
  ADD COLUMN IF NOT EXISTS "match_type"     TEXT,
  ADD COLUMN IF NOT EXISTS "match_data"     JSONB,
  ADD COLUMN IF NOT EXISTS "toss_winner_id" UUID,
  ADD COLUMN IF NOT EXISTS "toss_decision"  TEXT;
