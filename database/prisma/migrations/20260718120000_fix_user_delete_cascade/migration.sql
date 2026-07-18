-- Fix: admin could not delete users/orgs/opportunities that had any related
-- content, applications, follows, messages, notifications, or reports —
-- these FKs defaulted to ON DELETE RESTRICT/NO ACTION, so prisma.user.delete()
-- threw an unhandled FK violation (P2003) for any user with activity.
-- Cascade the ownership chain instead: User -> Organization -> Opportunity -> Application,
-- plus direct User FKs on Content/Comment/Follow/Message/Notification/Report.
-- AuditLog.actor_id is set to NULL instead of cascading, to preserve audit history
-- after the acting user is deleted.

-- DropForeignKey
ALTER TABLE "public"."Organization" DROP CONSTRAINT "Organization_owner_user_id_fkey";
ALTER TABLE "public"."Opportunity" DROP CONSTRAINT "Opportunity_org_id_fkey";
ALTER TABLE "public"."Opportunity" DROP CONSTRAINT "Opportunity_posted_by_user_id_fkey";
ALTER TABLE "public"."Application" DROP CONSTRAINT "Application_opportunity_id_fkey";
ALTER TABLE "public"."Application" DROP CONSTRAINT "Application_applicant_user_id_fkey";
ALTER TABLE "public"."Follow" DROP CONSTRAINT "Follow_follower_id_fkey";
ALTER TABLE "public"."Follow" DROP CONSTRAINT "Follow_followee_id_fkey";
ALTER TABLE "public"."Content" DROP CONSTRAINT "Content_author_id_fkey";
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_author_id_fkey";
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_conversation_id_fkey";
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_sender_id_fkey";
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_user_id_fkey";
ALTER TABLE "public"."Report" DROP CONSTRAINT "Report_reporter_id_fkey";
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_actor_id_fkey";

-- AlterTable
ALTER TABLE "public"."AuditLog" ALTER COLUMN "actor_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Organization" ADD CONSTRAINT "Organization_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Application" ADD CONSTRAINT "Application_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "public"."Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Application" ADD CONSTRAINT "Application_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Follow" ADD CONSTRAINT "Follow_followee_id_fkey" FOREIGN KEY ("followee_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Content" ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
