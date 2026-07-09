-- Guardian consent for under-18 accounts (minors-and-safety feature).
-- No backfill: existing rows keep the column defaults (is_minor=false,
-- guardian_consent_status='not_applicable') regardless of real age, since
-- gating only ever gets set going forward at signup time.

-- Create GuardianConsentStatus enum
DO $$ BEGIN
    CREATE TYPE "GuardianConsentStatus" AS ENUM ('not_applicable', 'pending', 'approved');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add guardian_consent to EmailType enum
ALTER TYPE "EmailType" ADD VALUE IF NOT EXISTS 'guardian_consent';

-- Add minor/guardian-consent columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_minor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardian_email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardian_consent_status" "GuardianConsentStatus" NOT NULL DEFAULT 'not_applicable';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "guardian_consent_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_role_guardian_consent_status_idx" ON "User"("role", "guardian_consent_status");

-- Create GuardianConsent table (mirrors EmailVerification)
CREATE TABLE IF NOT EXISTS "GuardianConsent" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"        UUID NOT NULL,
    "guardian_email" TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuardianConsent_token_key" ON "GuardianConsent"("token");
CREATE INDEX IF NOT EXISTS "GuardianConsent_user_id_idx" ON "GuardianConsent"("user_id");
