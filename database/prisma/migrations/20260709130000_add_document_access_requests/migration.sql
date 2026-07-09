-- Athlete document access requests: grants a recruiter (club/scout/organizer)
-- access to ALL of an athlete's UserDocument rows via a single approve/reject/
-- revoke workflow, rather than per-document sharing.

-- Create DocAccessStatus enum
DO $$ BEGIN
    CREATE TYPE "DocAccessStatus" AS ENUM ('pending', 'approved', 'rejected', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create DocumentAccessRequest table
CREATE TABLE IF NOT EXISTS "DocumentAccessRequest" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "athlete_id"   UUID NOT NULL,
    "status"       "DocAccessStatus" NOT NULL DEFAULT 'pending',
    "reason"       TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at"   TIMESTAMP(3),
    "decided_by"   UUID,

    CONSTRAINT "DocumentAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentAccessRequest_requester_id_athlete_id_key"
    ON "DocumentAccessRequest"("requester_id", "athlete_id");

CREATE INDEX IF NOT EXISTS "DocumentAccessRequest_athlete_id_status_idx"
    ON "DocumentAccessRequest"("athlete_id", "status");

DO $$ BEGIN
    ALTER TABLE "DocumentAccessRequest"
        ADD CONSTRAINT "DocumentAccessRequest_requester_id_fkey"
        FOREIGN KEY ("requester_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "DocumentAccessRequest"
        ADD CONSTRAINT "DocumentAccessRequest_athlete_id_fkey"
        FOREIGN KEY ("athlete_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
