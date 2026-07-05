-- Phase 0 (docs/SCALING_PLAN.md): merges the scoring backend's tables into
-- the main database under a "scoring" Postgres schema. No data migration —
-- scoring has no production data yet.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "scoring";

-- CreateEnum
CREATE TYPE "scoring"."TournamentStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "scoring"."MatchStatus" AS ENUM ('upcoming', 'live', 'completed', 'abandoned', 'no_result');

-- CreateEnum
CREATE TYPE "scoring"."BattingStatus" AS ENUM ('yet_to_bat', 'not_out', 'out', 'retired_hurt');

-- CreateTable
CREATE TABLE "scoring"."Tournament" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "format" TEXT,
    "season" TEXT,
    "match_type" TEXT,
    "description" TEXT,
    "start_date" TEXT,
    "end_date" TEXT,
    "location" TEXT,
    "status" "scoring"."TournamentStatus" NOT NULL DEFAULT 'upcoming',
    "overs_per_innings" INTEGER,
    "number_of_innings" INTEGER,
    "ball_type" TEXT,
    "powerplay_overs" JSONB,
    "super_over_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dls_enabled" BOOLEAN NOT NULL DEFAULT false,
    "free_hit_enabled" BOOLEAN NOT NULL DEFAULT true,
    "no_ball_rule" TEXT,
    "wide_rule" TEXT,
    "tie_break_rule" TEXT,
    "retired_hurt_allowed" BOOLEAN NOT NULL DEFAULT true,
    "substitutes_allowed" BOOLEAN NOT NULL DEFAULT true,
    "logo_url" TEXT,
    "banner_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "opportunity_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."Team" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT,
    "logo_url" TEXT,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."Player" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "jersey_number" INTEGER,
    "role" TEXT,
    "batting_style" TEXT,
    "bowling_style" TEXT,
    "is_captain" BOOLEAN NOT NULL DEFAULT false,
    "is_keeper" BOOLEAN NOT NULL DEFAULT false,
    "photo_url" TEXT,
    "sportivox_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."Match" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "match_number" INTEGER,
    "title" TEXT,
    "sport" TEXT NOT NULL,
    "format" TEXT,
    "team1_id" UUID NOT NULL,
    "team2_id" UUID NOT NULL,
    "venue" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "status" "scoring"."MatchStatus" NOT NULL DEFAULT 'upcoming',
    "winner_team_id" UUID,
    "result_summary" TEXT,
    "toss_winner_id" UUID,
    "toss_decision" TEXT,
    "team1_playing_level" TEXT,
    "team2_playing_level" TEXT,
    "match_type" TEXT,
    "umpire1" TEXT,
    "umpire2" TEXT,
    "tv_umpire" TEXT,
    "match_referee" TEXT,
    "player_of_match_id" UUID,
    "match_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."MatchPlayer" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "batting_position" INTEGER,
    "is_impact_player" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."Innings" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "innings_number" INTEGER NOT NULL,
    "batting_team_id" UUID NOT NULL,
    "bowling_team_id" UUID NOT NULL,
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "total_wickets" INTEGER NOT NULL DEFAULT 0,
    "total_balls" INTEGER NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "wides" INTEGER NOT NULL DEFAULT 0,
    "no_balls" INTEGER NOT NULL DEFAULT 0,
    "byes" INTEGER NOT NULL DEFAULT 0,
    "leg_byes" INTEGER NOT NULL DEFAULT 0,
    "penalty_runs" INTEGER NOT NULL DEFAULT 0,
    "boundary_4s" INTEGER NOT NULL DEFAULT 0,
    "boundary_6s" INTEGER NOT NULL DEFAULT 0,
    "dot_balls" INTEGER NOT NULL DEFAULT 0,
    "pp_runs" INTEGER NOT NULL DEFAULT 0,
    "pp_wickets" INTEGER NOT NULL DEFAULT 0,
    "pp_balls" INTEGER NOT NULL DEFAULT 0,
    "mid_runs" INTEGER NOT NULL DEFAULT 0,
    "mid_wickets" INTEGER NOT NULL DEFAULT 0,
    "mid_balls" INTEGER NOT NULL DEFAULT 0,
    "death_runs" INTEGER NOT NULL DEFAULT 0,
    "death_wickets" INTEGER NOT NULL DEFAULT 0,
    "death_balls" INTEGER NOT NULL DEFAULT 0,
    "projected_score" INTEGER,
    "win_probability" DOUBLE PRECISION,
    "momentum_index" DOUBLE PRECISION,
    "target" INTEGER,
    "is_declared" BOOLEAN NOT NULL DEFAULT false,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."BattingEntry" (
    "id" UUID NOT NULL,
    "innings_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "batting_position" INTEGER NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "balls_faced" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "dot_balls" INTEGER NOT NULL DEFAULT 0,
    "singles" INTEGER NOT NULL DEFAULT 0,
    "doubles" INTEGER NOT NULL DEFAULT 0,
    "threes" INTEGER NOT NULL DEFAULT 0,
    "status" "scoring"."BattingStatus" NOT NULL DEFAULT 'yet_to_bat',
    "dismissal_type" TEXT,
    "dismissed_by_id" UUID,
    "fielder_id" UUID,
    "dismissal_desc" TEXT,
    "dismissal_shot" TEXT,
    "dismissal_line" TEXT,
    "dismissal_length" TEXT,
    "dismissal_bowler_type" TEXT,
    "dismissal_zone" TEXT,
    "dismissal_trajectory" TEXT,
    "dismissal_fielding_position" TEXT,
    "strong_zone" TEXT,
    "weak_zone" TEXT,
    "strength_vs" TEXT,
    "preferred_zone" TEXT,
    "scouting_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."BowlingEntry" (
    "id" UUID NOT NULL,
    "innings_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "runs_conceded" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "wides" INTEGER NOT NULL DEFAULT 0,
    "no_balls" INTEGER NOT NULL DEFAULT 0,
    "dot_balls" INTEGER NOT NULL DEFAULT 0,
    "boundaries_4s" INTEGER NOT NULL DEFAULT 0,
    "boundaries_6s" INTEGER NOT NULL DEFAULT 0,
    "spell_number" INTEGER,
    "spell_start_over" INTEGER,
    "spell_end_over" INTEGER,
    "pp_runs" INTEGER NOT NULL DEFAULT 0,
    "pp_balls" INTEGER NOT NULL DEFAULT 0,
    "pp_wickets" INTEGER NOT NULL DEFAULT 0,
    "mid_runs" INTEGER NOT NULL DEFAULT 0,
    "mid_balls" INTEGER NOT NULL DEFAULT 0,
    "mid_wickets" INTEGER NOT NULL DEFAULT 0,
    "death_runs" INTEGER NOT NULL DEFAULT 0,
    "death_balls" INTEGER NOT NULL DEFAULT 0,
    "death_wickets" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BowlingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."FieldingEntry" (
    "id" UUID NOT NULL,
    "innings_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "drops" INTEGER NOT NULL DEFAULT 0,
    "run_outs_direct" INTEGER NOT NULL DEFAULT 0,
    "run_outs_assist" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "direct_hits" INTEGER NOT NULL DEFAULT 0,
    "misfields" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "impact_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."Partnership" (
    "id" UUID NOT NULL,
    "innings_id" UUID NOT NULL,
    "wicket_number" INTEGER NOT NULL,
    "player1_id" UUID NOT NULL,
    "player2_id" UUID NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "is_unbroken" BOOLEAN NOT NULL DEFAULT true,
    "ended_over" INTEGER,
    "ended_ball" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."BallEvent" (
    "id" UUID NOT NULL,
    "innings_id" UUID NOT NULL,
    "over_number" INTEGER NOT NULL,
    "ball_number" INTEGER NOT NULL,
    "batsman_id" UUID NOT NULL,
    "bowler_id" UUID NOT NULL,
    "non_striker_id" UUID,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "is_wide" BOOLEAN NOT NULL DEFAULT false,
    "is_no_ball" BOOLEAN NOT NULL DEFAULT false,
    "is_bye" BOOLEAN NOT NULL DEFAULT false,
    "is_leg_bye" BOOLEAN NOT NULL DEFAULT false,
    "is_penalty" BOOLEAN NOT NULL DEFAULT false,
    "is_wicket" BOOLEAN NOT NULL DEFAULT false,
    "is_four" BOOLEAN NOT NULL DEFAULT false,
    "is_six" BOOLEAN NOT NULL DEFAULT false,
    "is_free_hit" BOOLEAN NOT NULL DEFAULT false,
    "is_dot" BOOLEAN NOT NULL DEFAULT false,
    "shot_type" TEXT,
    "ball_line" TEXT,
    "ball_length" TEXT,
    "bowler_variant" TEXT,
    "delivery_outcome" TEXT,
    "phase" TEXT,
    "season" TEXT,
    "year" INTEGER,
    "wicket_type" TEXT,
    "dismissed_player_id" UUID,
    "fielder_id" UUID,
    "fielder_name" TEXT,
    "fielding_position" TEXT,
    "dismissal_zone" TEXT,
    "ball_trajectory" TEXT,
    "commentary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."PlayerCareerStats" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "innings_batted" INTEGER NOT NULL DEFAULT 0,
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "balls_faced" INTEGER NOT NULL DEFAULT 0,
    "highest_score" INTEGER NOT NULL DEFAULT 0,
    "not_outs" INTEGER NOT NULL DEFAULT 0,
    "hundreds" INTEGER NOT NULL DEFAULT 0,
    "fifties" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "innings_bowled" INTEGER NOT NULL DEFAULT 0,
    "balls_bowled" INTEGER NOT NULL DEFAULT 0,
    "runs_conceded" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "five_wicket_hauls" INTEGER NOT NULL DEFAULT 0,
    "best_bowling_wickets" INTEGER NOT NULL DEFAULT 0,
    "best_bowling_runs" INTEGER NOT NULL DEFAULT 9999,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "run_outs" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCareerStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."MatchEvent" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "team_id" UUID,
    "player_id" UUID,
    "event_type" TEXT NOT NULL,
    "minute" INTEGER,
    "period" TEXT,
    "value" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "season" TEXT,
    "year" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_sport_idx" ON "scoring"."Tournament"("status", "sport");

-- CreateIndex
CREATE INDEX "Tournament_created_by_idx" ON "scoring"."Tournament"("created_by");

-- CreateIndex
CREATE INDEX "Tournament_opportunity_id_idx" ON "scoring"."Tournament"("opportunity_id");

-- CreateIndex
CREATE INDEX "Team_tournament_id_idx" ON "scoring"."Team"("tournament_id");

-- CreateIndex
CREATE INDEX "Player_team_id_idx" ON "scoring"."Player"("team_id");

-- CreateIndex
CREATE INDEX "Match_tournament_id_status_idx" ON "scoring"."Match"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "scoring"."Match"("status");

-- CreateIndex
CREATE INDEX "MatchPlayer_match_id_team_id_idx" ON "scoring"."MatchPlayer"("match_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_match_id_player_id_key" ON "scoring"."MatchPlayer"("match_id", "player_id");

-- CreateIndex
CREATE INDEX "Innings_match_id_idx" ON "scoring"."Innings"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "Innings_match_id_innings_number_key" ON "scoring"."Innings"("match_id", "innings_number");

-- CreateIndex
CREATE INDEX "BattingEntry_innings_id_idx" ON "scoring"."BattingEntry"("innings_id");

-- CreateIndex
CREATE UNIQUE INDEX "BattingEntry_innings_id_player_id_key" ON "scoring"."BattingEntry"("innings_id", "player_id");

-- CreateIndex
CREATE INDEX "BowlingEntry_innings_id_idx" ON "scoring"."BowlingEntry"("innings_id");

-- CreateIndex
CREATE UNIQUE INDEX "BowlingEntry_innings_id_player_id_key" ON "scoring"."BowlingEntry"("innings_id", "player_id");

-- CreateIndex
CREATE INDEX "FieldingEntry_innings_id_idx" ON "scoring"."FieldingEntry"("innings_id");

-- CreateIndex
CREATE UNIQUE INDEX "FieldingEntry_innings_id_player_id_key" ON "scoring"."FieldingEntry"("innings_id", "player_id");

-- CreateIndex
CREATE INDEX "Partnership_innings_id_idx" ON "scoring"."Partnership"("innings_id");

-- CreateIndex
CREATE UNIQUE INDEX "Partnership_innings_id_wicket_number_key" ON "scoring"."Partnership"("innings_id", "wicket_number");

-- CreateIndex
CREATE INDEX "BallEvent_innings_id_over_number_ball_number_idx" ON "scoring"."BallEvent"("innings_id", "over_number", "ball_number");

-- CreateIndex
CREATE INDEX "BallEvent_innings_id_phase_idx" ON "scoring"."BallEvent"("innings_id", "phase");

-- CreateIndex
CREATE INDEX "BallEvent_bowler_id_ball_length_idx" ON "scoring"."BallEvent"("bowler_id", "ball_length");

-- CreateIndex
CREATE INDEX "BallEvent_bowler_id_ball_line_idx" ON "scoring"."BallEvent"("bowler_id", "ball_line");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerCareerStats_player_id_key" ON "scoring"."PlayerCareerStats"("player_id");

-- CreateIndex
CREATE INDEX "MatchEvent_match_id_idx" ON "scoring"."MatchEvent"("match_id");

-- AddForeignKey
ALTER TABLE "scoring"."Tournament" ADD CONSTRAINT "Tournament_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Team" ADD CONSTRAINT "Team_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "scoring"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Player" ADD CONSTRAINT "Player_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "scoring"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Match" ADD CONSTRAINT "Match_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "scoring"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Match" ADD CONSTRAINT "Match_team1_id_fkey" FOREIGN KEY ("team1_id") REFERENCES "scoring"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Match" ADD CONSTRAINT "Match_team2_id_fkey" FOREIGN KEY ("team2_id") REFERENCES "scoring"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."MatchPlayer" ADD CONSTRAINT "MatchPlayer_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "scoring"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."MatchPlayer" ADD CONSTRAINT "MatchPlayer_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "scoring"."Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."MatchPlayer" ADD CONSTRAINT "MatchPlayer_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Innings" ADD CONSTRAINT "Innings_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "scoring"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Innings" ADD CONSTRAINT "Innings_batting_team_id_fkey" FOREIGN KEY ("batting_team_id") REFERENCES "scoring"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Innings" ADD CONSTRAINT "Innings_bowling_team_id_fkey" FOREIGN KEY ("bowling_team_id") REFERENCES "scoring"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BattingEntry" ADD CONSTRAINT "BattingEntry_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "scoring"."Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BattingEntry" ADD CONSTRAINT "BattingEntry_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BowlingEntry" ADD CONSTRAINT "BowlingEntry_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "scoring"."Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BowlingEntry" ADD CONSTRAINT "BowlingEntry_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."FieldingEntry" ADD CONSTRAINT "FieldingEntry_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "scoring"."Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."FieldingEntry" ADD CONSTRAINT "FieldingEntry_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."Partnership" ADD CONSTRAINT "Partnership_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "scoring"."Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BallEvent" ADD CONSTRAINT "BallEvent_innings_id_fkey" FOREIGN KEY ("innings_id") REFERENCES "scoring"."Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BallEvent" ADD CONSTRAINT "BallEvent_batsman_id_fkey" FOREIGN KEY ("batsman_id") REFERENCES "scoring"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."BallEvent" ADD CONSTRAINT "BallEvent_bowler_id_fkey" FOREIGN KEY ("bowler_id") REFERENCES "scoring"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."PlayerCareerStats" ADD CONSTRAINT "PlayerCareerStats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."MatchEvent" ADD CONSTRAINT "MatchEvent_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "scoring"."Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
