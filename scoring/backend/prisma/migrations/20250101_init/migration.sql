-- Initial schema for the scoring service.
-- The original DB was set up with `prisma db push` (no migration history).
-- This migration recreates the base tables so that `prisma migrate deploy`
-- works correctly on a fresh database (e.g. new Postgres schema or CI env).
-- All statements are idempotent so re-running is safe.

-- ── Schema ────────────────────────────────────────────────────────────────────
-- Prisma auto-creates the schema from the ?schema= URL param, but we include
-- this as a safety net for environments that might run the SQL directly.
CREATE SCHEMA IF NOT EXISTS scoring;

-- ── Enums (DO-block guards because PostgreSQL has no CREATE TYPE IF NOT EXISTS)
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('admin', 'organizer', 'scorer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TournamentStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MatchStatus" AS ENUM ('upcoming', 'live', 'completed', 'abandoned', 'no_result');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BattingStatus" AS ENUM ('yet_to_bat', 'not_out', 'out', 'retired_hurt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── User ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "User" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name"     TEXT NOT NULL,
  "role"          "UserRole" NOT NULL DEFAULT 'viewer',
  "avatar_url"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_email_key" UNIQUE ("email")
);

-- ── RefreshToken ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "RefreshToken" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"    UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token"      TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked"    BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_token_key" UNIQUE ("token")
);
CREATE INDEX IF NOT EXISTS "RefreshToken_user_id_idx" ON "RefreshToken" ("user_id");

-- ── Tournament (base columns; cricket config added by 20260531; season/match_type by 20260611)
CREATE TABLE IF NOT EXISTS "Tournament" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        TEXT NOT NULL,
  "sport"       TEXT NOT NULL,
  "format"      TEXT,
  "description" TEXT,
  "start_date"  TEXT,
  "end_date"    TEXT,
  "location"    TEXT,
  "status"      "TournamentStatus" NOT NULL DEFAULT 'upcoming',
  "logo_url"    TEXT,
  "banner_url"  TEXT,
  "is_public"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_by"  UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Tournament_status_sport_idx" ON "Tournament" ("status", "sport");
CREATE INDEX IF NOT EXISTS "Tournament_created_by_idx"   ON "Tournament" ("created_by");

-- ── Team ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Team" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tournament_id" UUID NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "name"          TEXT NOT NULL,
  "short_name"    TEXT,
  "logo_url"      TEXT,
  "color"         TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Team_tournament_id_idx" ON "Team" ("tournament_id");

-- ── Player ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Player" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "team_id"           UUID NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "name"              TEXT NOT NULL,
  "jersey_number"     INTEGER,
  "role"              TEXT,
  "batting_style"     TEXT,
  "bowling_style"     TEXT,
  "is_captain"        BOOLEAN NOT NULL DEFAULT FALSE,
  "is_keeper"         BOOLEAN NOT NULL DEFAULT FALSE,
  "photo_url"         TEXT,
  "sportivox_user_id" TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Player_team_id_idx" ON "Player" ("team_id");

-- ── Match (base columns; toss_winner_id/toss_decision/match_type/match_data added by 20260611)
CREATE TABLE IF NOT EXISTS "Match" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tournament_id"  UUID NOT NULL REFERENCES "Tournament"("id") ON DELETE CASCADE,
  "match_number"   INTEGER,
  "title"          TEXT,
  "sport"          TEXT NOT NULL,
  "format"         TEXT,
  "team1_id"       UUID NOT NULL REFERENCES "Team"("id"),
  "team2_id"       UUID NOT NULL REFERENCES "Team"("id"),
  "venue"          TEXT,
  "scheduled_at"   TIMESTAMP(3),
  "status"         "MatchStatus" NOT NULL DEFAULT 'upcoming',
  "winner_team_id" UUID,
  "result_summary" TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Match_tournament_id_status_idx" ON "Match" ("tournament_id", "status");
CREATE INDEX IF NOT EXISTS "Match_status_idx"                ON "Match" ("status");

-- ── MatchPlayer ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MatchPlayer" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id"         UUID NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
  "team_id"          UUID NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "player_id"        UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,
  "batting_position" INTEGER,
  CONSTRAINT "MatchPlayer_match_player_uniq" UNIQUE ("match_id", "player_id")
);
CREATE INDEX IF NOT EXISTS "MatchPlayer_match_id_team_id_idx" ON "MatchPlayer" ("match_id", "team_id");

-- ── Innings (base columns; phase splits / boundary counters added by 20260531)
CREATE TABLE IF NOT EXISTS "Innings" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id"        UUID NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
  "innings_number"  INTEGER NOT NULL,
  "batting_team_id" UUID NOT NULL REFERENCES "Team"("id"),
  "bowling_team_id" UUID NOT NULL REFERENCES "Team"("id"),
  "total_runs"      INTEGER NOT NULL DEFAULT 0,
  "total_wickets"   INTEGER NOT NULL DEFAULT 0,
  "total_balls"     INTEGER NOT NULL DEFAULT 0,
  "extras"          INTEGER NOT NULL DEFAULT 0,
  "wides"           INTEGER NOT NULL DEFAULT 0,
  "no_balls"        INTEGER NOT NULL DEFAULT 0,
  "byes"            INTEGER NOT NULL DEFAULT 0,
  "leg_byes"        INTEGER NOT NULL DEFAULT 0,
  "target"          INTEGER,
  "is_declared"     BOOLEAN NOT NULL DEFAULT FALSE,
  "is_completed"    BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Innings_match_innings_uniq" UNIQUE ("match_id", "innings_number")
);
CREATE INDEX IF NOT EXISTS "Innings_match_id_idx" ON "Innings" ("match_id");

-- ── BattingEntry (base columns; dismissal analytics / scouting fields added by 20260531)
CREATE TABLE IF NOT EXISTS "BattingEntry" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "innings_id"       UUID NOT NULL REFERENCES "Innings"("id") ON DELETE CASCADE,
  "player_id"        UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,
  "batting_position" INTEGER NOT NULL,
  "runs"             INTEGER NOT NULL DEFAULT 0,
  "balls_faced"      INTEGER NOT NULL DEFAULT 0,
  "fours"            INTEGER NOT NULL DEFAULT 0,
  "sixes"            INTEGER NOT NULL DEFAULT 0,
  "status"           "BattingStatus" NOT NULL DEFAULT 'yet_to_bat',
  "dismissal_type"   TEXT,
  "dismissed_by_id"  UUID,
  "fielder_id"       UUID,
  "dismissal_desc"   TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BattingEntry_innings_player_uniq" UNIQUE ("innings_id", "player_id")
);
CREATE INDEX IF NOT EXISTS "BattingEntry_innings_id_idx" ON "BattingEntry" ("innings_id");

-- ── BowlingEntry (base columns; dot/boundary/spell/phase fields added by 20260531)
CREATE TABLE IF NOT EXISTS "BowlingEntry" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "innings_id"    UUID NOT NULL REFERENCES "Innings"("id") ON DELETE CASCADE,
  "player_id"     UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,
  "balls"         INTEGER NOT NULL DEFAULT 0,
  "maidens"       INTEGER NOT NULL DEFAULT 0,
  "runs_conceded" INTEGER NOT NULL DEFAULT 0,
  "wickets"       INTEGER NOT NULL DEFAULT 0,
  "wides"         INTEGER NOT NULL DEFAULT 0,
  "no_balls"      INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BowlingEntry_innings_player_uniq" UNIQUE ("innings_id", "player_id")
);
CREATE INDEX IF NOT EXISTS "BowlingEntry_innings_id_idx" ON "BowlingEntry" ("innings_id");

-- ── BallEvent (base columns; level-1/2 analytics fields added by 20260531)
CREATE TABLE IF NOT EXISTS "BallEvent" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "innings_id"          UUID NOT NULL REFERENCES "Innings"("id") ON DELETE CASCADE,
  "over_number"         INTEGER NOT NULL,
  "ball_number"         INTEGER NOT NULL,
  "batsman_id"          UUID NOT NULL REFERENCES "Player"("id"),
  "bowler_id"           UUID NOT NULL REFERENCES "Player"("id"),
  "runs"                INTEGER NOT NULL DEFAULT 0,
  "is_wide"             BOOLEAN NOT NULL DEFAULT FALSE,
  "is_no_ball"          BOOLEAN NOT NULL DEFAULT FALSE,
  "is_bye"              BOOLEAN NOT NULL DEFAULT FALSE,
  "is_leg_bye"          BOOLEAN NOT NULL DEFAULT FALSE,
  "is_wicket"           BOOLEAN NOT NULL DEFAULT FALSE,
  "is_four"             BOOLEAN NOT NULL DEFAULT FALSE,
  "is_six"              BOOLEAN NOT NULL DEFAULT FALSE,
  "wicket_type"         TEXT,
  "dismissed_player_id" UUID,
  "fielder_id"          UUID,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BallEvent_innings_id_over_ball_idx" ON "BallEvent" ("innings_id", "over_number", "ball_number");

-- ── PlayerCareerStats ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PlayerCareerStats" (
  "id"                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "player_id"            UUID NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE,
  "matches_played"       INTEGER NOT NULL DEFAULT 0,
  "innings_batted"       INTEGER NOT NULL DEFAULT 0,
  "total_runs"           INTEGER NOT NULL DEFAULT 0,
  "balls_faced"          INTEGER NOT NULL DEFAULT 0,
  "highest_score"        INTEGER NOT NULL DEFAULT 0,
  "not_outs"             INTEGER NOT NULL DEFAULT 0,
  "hundreds"             INTEGER NOT NULL DEFAULT 0,
  "fifties"              INTEGER NOT NULL DEFAULT 0,
  "fours"                INTEGER NOT NULL DEFAULT 0,
  "sixes"                INTEGER NOT NULL DEFAULT 0,
  "innings_bowled"       INTEGER NOT NULL DEFAULT 0,
  "balls_bowled"         INTEGER NOT NULL DEFAULT 0,
  "runs_conceded"        INTEGER NOT NULL DEFAULT 0,
  "wickets"              INTEGER NOT NULL DEFAULT 0,
  "maidens"              INTEGER NOT NULL DEFAULT 0,
  "five_wicket_hauls"    INTEGER NOT NULL DEFAULT 0,
  "best_bowling_wickets" INTEGER NOT NULL DEFAULT 0,
  "best_bowling_runs"    INTEGER NOT NULL DEFAULT 9999,
  "catches"              INTEGER NOT NULL DEFAULT 0,
  "run_outs"             INTEGER NOT NULL DEFAULT 0,
  "stumpings"            INTEGER NOT NULL DEFAULT 0,
  "updated_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerCareerStats_player_id_key" UNIQUE ("player_id")
);

-- ── MatchEvent ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MatchEvent" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "match_id"    UUID NOT NULL REFERENCES "Match"("id") ON DELETE CASCADE,
  "team_id"     UUID,
  "player_id"   UUID,
  "event_type"  TEXT NOT NULL,
  "minute"      INTEGER,
  "period"      TEXT,
  "value"       INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MatchEvent_match_id_idx" ON "MatchEvent" ("match_id");
