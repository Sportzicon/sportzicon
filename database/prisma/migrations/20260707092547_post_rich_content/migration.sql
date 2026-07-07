-- AlterTable
ALTER TABLE "public"."PostDetail" DROP COLUMN "media_urls",
DROP COLUMN "text",
ADD COLUMN     "content_json" JSONB NOT NULL,
ADD COLUMN     "media" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "text_excerpt" TEXT NOT NULL;
