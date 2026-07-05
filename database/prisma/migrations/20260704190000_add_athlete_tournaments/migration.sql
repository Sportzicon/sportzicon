-- CreateTable
CREATE TABLE "AthleteTournament" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "team" TEXT,
    "format" TEXT,
    "result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteTournament_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AthleteTournament_user_id_idx" ON "AthleteTournament"("user_id");

-- AddForeignKey
ALTER TABLE "AthleteTournament" ADD CONSTRAINT "AthleteTournament_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
