-- AlterTable
ALTER TABLE "scoring"."Match" ADD COLUMN     "org_tournament_id" UUID;

-- CreateTable
CREATE TABLE "public"."OrgTournament" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "season" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "scoring_tournament_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgTeam" (
    "id" UUID NOT NULL,
    "org_tournament_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scoring_team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrgTournamentStandings" (
    "id" UUID NOT NULL,
    "org_tournament_id" UUID NOT NULL,
    "org_team_id" UUID NOT NULL,
    "matches_played" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgTournamentStandings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgTournament_organization_id_idx" ON "public"."OrgTournament"("organization_id");

-- CreateIndex
CREATE INDEX "OrgTeam_org_tournament_id_idx" ON "public"."OrgTeam"("org_tournament_id");

-- CreateIndex
CREATE UNIQUE INDEX "OrgTournamentStandings_org_team_id_key" ON "public"."OrgTournamentStandings"("org_team_id");

-- CreateIndex
CREATE INDEX "OrgTournamentStandings_org_tournament_id_idx" ON "public"."OrgTournamentStandings"("org_tournament_id");

-- AddForeignKey
ALTER TABLE "public"."OrgTournament" ADD CONSTRAINT "OrgTournament_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgTeam" ADD CONSTRAINT "OrgTeam_org_tournament_id_fkey" FOREIGN KEY ("org_tournament_id") REFERENCES "public"."OrgTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgTournamentStandings" ADD CONSTRAINT "OrgTournamentStandings_org_tournament_id_fkey" FOREIGN KEY ("org_tournament_id") REFERENCES "public"."OrgTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrgTournamentStandings" ADD CONSTRAINT "OrgTournamentStandings_org_team_id_fkey" FOREIGN KEY ("org_team_id") REFERENCES "public"."OrgTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
