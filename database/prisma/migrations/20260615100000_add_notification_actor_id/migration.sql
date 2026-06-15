-- Add actor_id to Notification for showing actor avatars
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "actor_id" UUID;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
