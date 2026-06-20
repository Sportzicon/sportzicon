-- Add scoring_tournament_id to Opportunity for cross-system integration with scoring console
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "scoring_tournament_id" TEXT;
CREATE INDEX IF NOT EXISTS "Opportunity_scoring_tournament_id_idx" ON "Opportunity"("scoring_tournament_id") WHERE "scoring_tournament_id" IS NOT NULL;
