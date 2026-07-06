-- CreateTable
CREATE TABLE "scoring"."PlayerSeasonStats" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "season" TEXT NOT NULL,
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

    CONSTRAINT "PlayerSeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring"."PlayerTournamentStats" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
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

    CONSTRAINT "PlayerTournamentStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerSeasonStats_season_idx" ON "scoring"."PlayerSeasonStats"("season");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStats_player_id_season_key" ON "scoring"."PlayerSeasonStats"("player_id", "season");

-- CreateIndex
CREATE INDEX "PlayerTournamentStats_tournament_id_idx" ON "scoring"."PlayerTournamentStats"("tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTournamentStats_player_id_tournament_id_key" ON "scoring"."PlayerTournamentStats"("player_id", "tournament_id");

-- AddForeignKey
ALTER TABLE "scoring"."PlayerSeasonStats" ADD CONSTRAINT "PlayerSeasonStats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."PlayerTournamentStats" ADD CONSTRAINT "PlayerTournamentStats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "scoring"."Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring"."PlayerTournamentStats" ADD CONSTRAINT "PlayerTournamentStats_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "scoring"."Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
