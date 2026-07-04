-- AlterTable
ALTER TABLE "Opportunity" ALTER COLUMN "application_deadline" TYPE DATE USING "application_deadline"::date;
