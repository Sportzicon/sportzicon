-- Add player_of_match_id to Match (no FK — cross-team reference)
ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "player_of_match_id" UUID;

-- Add is_impact_player flag to MatchPlayer (IPL Impact Player rule)
ALTER TABLE "MatchPlayer" ADD COLUMN IF NOT EXISTS "is_impact_player" BOOLEAN NOT NULL DEFAULT false;
