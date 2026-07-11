-- Playing level concept removed entirely — Playing XI selection is the
-- only prerequisite enforced before an innings can start.
ALTER TABLE "scoring"."Match" DROP COLUMN "team1_playing_level";
ALTER TABLE "scoring"."Match" DROP COLUMN "team2_playing_level";
