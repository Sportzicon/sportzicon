-- Add suspension columns if not present (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspended_at" TIMESTAMP(3);

-- If old ban columns exist, migrate data then drop them
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'is_banned'
  ) THEN
    UPDATE "User" SET
      is_suspended    = is_banned,
      suspension_reason = banned_reason,
      suspended_at    = banned_at;
    ALTER TABLE "User" DROP COLUMN is_banned;
    ALTER TABLE "User" DROP COLUMN banned_reason;
    ALTER TABLE "User" DROP COLUMN banned_at;
  END IF;
END $$;
