-- Add opportunity_id to Tournament for cross-system integration with main Sportivox app
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "opportunity_id" UUID;
CREATE INDEX IF NOT EXISTS "Tournament_opportunity_id_idx" ON "Tournament"("opportunity_id");
