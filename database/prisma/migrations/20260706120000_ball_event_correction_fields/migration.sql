-- AlterTable
ALTER TABLE "scoring"."BallEvent" ADD COLUMN     "correction_of_id" UUID,
ADD COLUMN     "voided" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "voided_reason" TEXT;

-- CreateIndex
CREATE INDEX "BallEvent_innings_id_voided_idx" ON "scoring"."BallEvent"("innings_id", "voided");

-- AddForeignKey
ALTER TABLE "scoring"."BallEvent" ADD CONSTRAINT "BallEvent_correction_of_id_fkey" FOREIGN KEY ("correction_of_id") REFERENCES "scoring"."BallEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
