-- Add scorer to Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'scorer';

-- Create EmailType enum
DO $$ BEGIN
    CREATE TYPE "EmailType" AS ENUM ('email_verification', 'password_reset', 'notification', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create EmailStatus enum
DO $$ BEGIN
    CREATE TYPE "EmailStatus" AS ENUM ('sent', 'failed', 'stub');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create EmailLog table
CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID,
    "to_email"   TEXT NOT NULL,
    "subject"    TEXT NOT NULL,
    "email_type" "EmailType" NOT NULL DEFAULT 'other',
    "status"     "EmailStatus" NOT NULL DEFAULT 'sent',
    "error"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- Add foreign key (idempotent)
DO $$ BEGIN
    ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "EmailLog_user_id_created_at_idx" ON "EmailLog"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "EmailLog_created_at_idx"          ON "EmailLog"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "EmailLog_email_type_idx"          ON "EmailLog"("email_type");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx"              ON "EmailLog"("status");
