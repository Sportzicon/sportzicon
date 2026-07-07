-- DropForeignKey
ALTER TABLE "public"."Blog" DROP CONSTRAINT "Blog_author_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."BlogLike" DROP CONSTRAINT "BlogLike_blog_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."BlogLike" DROP CONSTRAINT "BlogLike_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_blog_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_post_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_reel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Post" DROP CONSTRAINT "Post_author_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PostLike" DROP CONSTRAINT "PostLike_post_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."PostLike" DROP CONSTRAINT "PostLike_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reel" DROP CONSTRAINT "Reel_author_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReelLike" DROP CONSTRAINT "ReelLike_reel_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReelLike" DROP CONSTRAINT "ReelLike_user_id_fkey";

-- DropIndex
DROP INDEX "public"."Comment_blog_id_created_at_idx";

-- DropIndex
DROP INDEX "public"."Comment_post_id_created_at_idx";

-- DropIndex
DROP INDEX "public"."Comment_reel_id_created_at_idx";

-- AlterTable
ALTER TABLE "public"."Comment" DROP COLUMN "blog_id",
DROP COLUMN "parent_type",
DROP COLUMN "post_id",
DROP COLUMN "reel_id",
ADD COLUMN     "content_id" UUID NOT NULL;

-- DropTable
DROP TABLE "public"."Blog";

-- DropTable
DROP TABLE "public"."BlogLike";

-- DropTable
DROP TABLE "public"."Post";

-- DropTable
DROP TABLE "public"."PostLike";

-- DropTable
DROP TABLE "public"."Reel";

-- DropTable
DROP TABLE "public"."ReelLike";

-- CreateTable
CREATE TABLE "public"."Content" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content_type" TEXT NOT NULL,
    "sport" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "like_count" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PostDetail" (
    "content_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'post',
    "text" TEXT NOT NULL,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PostDetail_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "public"."BlogDetail" (
    "content_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "excerpt" TEXT NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),

    CONSTRAINT "BlogDetail_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "public"."ReelDetail" (
    "content_id" UUID NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "video_url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration_seconds" INTEGER,

    CONSTRAINT "ReelDetail_pkey" PRIMARY KEY ("content_id")
);

-- CreateTable
CREATE TABLE "public"."ContentLike" (
    "content_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentLike_pkey" PRIMARY KEY ("content_id","user_id")
);

-- CreateIndex
CREATE INDEX "Content_author_id_created_at_idx" ON "public"."Content"("author_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "Content_content_type_created_at_idx" ON "public"."Content"("content_type", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BlogDetail_slug_key" ON "public"."BlogDetail"("slug");

-- CreateIndex
CREATE INDEX "BlogDetail_status_published_at_idx" ON "public"."BlogDetail"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "BlogDetail_slug_idx" ON "public"."BlogDetail"("slug");

-- CreateIndex
CREATE INDEX "Comment_content_id_created_at_idx" ON "public"."Comment"("content_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."Content" ADD CONSTRAINT "Content_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PostDetail" ADD CONSTRAINT "PostDetail_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BlogDetail" ADD CONSTRAINT "BlogDetail_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReelDetail" ADD CONSTRAINT "ReelDetail_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentLike" ADD CONSTRAINT "ContentLike_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "public"."Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContentLike" ADD CONSTRAINT "ContentLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
