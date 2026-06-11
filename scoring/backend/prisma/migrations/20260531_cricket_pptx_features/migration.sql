-- Migration: Cricket PPTX features (Team config, Innings phase splits, Ball-level L1/L2 fields,
--            Batter / Bowler / Fielder analytics, Partnerships)
-- Generated for PR feature/cricket-scoring-and-automation.

-- ── Tournament: cricket match configuration ─────────────────────────────────
ALTER TABLE "Tournament"
  ADD COLUMN IF NOT EXISTS "overs_per_innings"    INTEGER,
  ADD COLUMN IF NOT EXISTS "number_of_innings"    INTEGER,
  ADD COLUMN IF NOT EXISTS "ball_type"            TEXT,
  ADD COLUMN IF NOT EXISTS "powerplay_overs"      JSONB,
  ADD COLUMN IF NOT EXISTS "super_over_enabled"   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "dls_enabled"          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "free_hit_enabled"     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "no_ball_rule"         TEXT,
  ADD COLUMN IF NOT EXISTS "wide_rule"            TEXT,
  ADD COLUMN IF NOT EXISTS "tie_break_rule"       TEXT,
  ADD COLUMN IF NOT EXISTS "retired_hurt_allowed" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "substitutes_allowed"  BOOLEAN NOT NULL DEFAULT TRUE;

-- ── Innings: phase / boundary / derived metrics ─────────────────────────────
ALTER TABLE "Innings"
  ADD COLUMN IF NOT EXISTS "penalty_runs"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "boundary_4s"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "boundary_6s"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dot_balls"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pp_runs"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pp_wickets"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pp_balls"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_runs"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_wickets"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_balls"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_runs"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_wickets" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_balls"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "projected_score" INTEGER,
  ADD COLUMN IF NOT EXISTS "win_probability" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "momentum_index"  DOUBLE PRECISION;

-- ── BallEvent: PPTX Level 1 + Level 2 fields ─────────────────────────────────
ALTER TABLE "BallEvent"
  ADD COLUMN IF NOT EXISTS "non_striker_id"    UUID,
  ADD COLUMN IF NOT EXISTS "is_penalty"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "is_free_hit"       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "is_dot"            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "shot_type"         TEXT,
  ADD COLUMN IF NOT EXISTS "ball_line"         TEXT,
  ADD COLUMN IF NOT EXISTS "ball_length"       TEXT,
  ADD COLUMN IF NOT EXISTS "bowler_variant"    TEXT,
  ADD COLUMN IF NOT EXISTS "delivery_outcome"  TEXT,
  ADD COLUMN IF NOT EXISTS "phase"             TEXT,
  ADD COLUMN IF NOT EXISTS "fielder_name"      TEXT,
  ADD COLUMN IF NOT EXISTS "fielding_position" TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_zone"    TEXT,
  ADD COLUMN IF NOT EXISTS "ball_trajectory"   TEXT,
  ADD COLUMN IF NOT EXISTS "commentary"        TEXT;

CREATE INDEX IF NOT EXISTS "BallEvent_innings_id_phase_idx"     ON "BallEvent" ("innings_id", "phase");
CREATE INDEX IF NOT EXISTS "BallEvent_bowler_id_ball_length_idx" ON "BallEvent" ("bowler_id", "ball_length");
CREATE INDEX IF NOT EXISTS "BallEvent_bowler_id_ball_line_idx"   ON "BallEvent" ("bowler_id", "ball_line");

-- ── BattingEntry: PPTX shot / dismissal / scouting fields ───────────────────
ALTER TABLE "BattingEntry"
  ADD COLUMN IF NOT EXISTS "dot_balls"                 INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "singles"                   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "doubles"                   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "threes"                    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "dismissal_shot"            TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_line"            TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_length"          TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_bowler_type"     TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_zone"            TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_trajectory"      TEXT,
  ADD COLUMN IF NOT EXISTS "dismissal_fielding_position" TEXT,
  ADD COLUMN IF NOT EXISTS "strong_zone"               TEXT,
  ADD COLUMN IF NOT EXISTS "weak_zone"                 TEXT,
  ADD COLUMN IF NOT EXISTS "strength_vs"               TEXT,
  ADD COLUMN IF NOT EXISTS "preferred_zone"            TEXT,
  ADD COLUMN IF NOT EXISTS "scouting_notes"            TEXT;

-- ── BowlingEntry: dot/boundary, spell, phase splits ─────────────────────────
ALTER TABLE "BowlingEntry"
  ADD COLUMN IF NOT EXISTS "dot_balls"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "boundaries_4s"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "boundaries_6s"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "spell_number"     INTEGER,
  ADD COLUMN IF NOT EXISTS "spell_start_over" INTEGER,
  ADD COLUMN IF NOT EXISTS "spell_end_over"   INTEGER,
  ADD COLUMN IF NOT EXISTS "pp_runs"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pp_balls"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pp_wickets"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_runs"         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_balls"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mid_wickets"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_runs"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_balls"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "death_wickets"    INTEGER NOT NULL DEFAULT 0;

-- ── FieldingEntry (new) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "FieldingEntry" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "innings_id"       UUID NOT NULL REFERENCES "Innings"("id") ON DELETE CASCADE,
  "player_id"        UUID NOT NULL REFERENCES "Player"("id"),
  "catches"          INTEGER NOT NULL DEFAULT 0,
  "drops"            INTEGER NOT NULL DEFAULT 0,
  "run_outs_direct"  INTEGER NOT NULL DEFAULT 0,
  "run_outs_assist"  INTEGER NOT NULL DEFAULT 0,
  "stumpings"        INTEGER NOT NULL DEFAULT 0,
  "direct_hits"      INTEGER NOT NULL DEFAULT 0,
  "misfields"        INTEGER NOT NULL DEFAULT 0,
  "assists"          INTEGER NOT NULL DEFAULT 0,
  "impact_score"     INTEGER NOT NULL DEFAULT 0,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldingEntry_innings_player_uniq" UNIQUE ("innings_id", "player_id")
);
CREATE INDEX IF NOT EXISTS "FieldingEntry_innings_id_idx" ON "FieldingEntry" ("innings_id");

-- ── Partnership (new) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Partnership" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "innings_id"    UUID NOT NULL REFERENCES "Innings"("id") ON DELETE CASCADE,
  "wicket_number" INTEGER NOT NULL,
  "player1_id"    UUID NOT NULL,
  "player2_id"    UUID NOT NULL,
  "runs"          INTEGER NOT NULL DEFAULT 0,
  "balls"         INTEGER NOT NULL DEFAULT 0,
  "fours"         INTEGER NOT NULL DEFAULT 0,
  "sixes"         INTEGER NOT NULL DEFAULT 0,
  "is_unbroken"   BOOLEAN NOT NULL DEFAULT TRUE,
  "ended_over"    INTEGER,
  "ended_ball"    INTEGER,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partnership_innings_wicket_uniq" UNIQUE ("innings_id", "wicket_number")
);
CREATE INDEX IF NOT EXISTS "Partnership_innings_id_idx" ON "Partnership" ("innings_id");
