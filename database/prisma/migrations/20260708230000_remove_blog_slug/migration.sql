-- Blogs are addressed by id only everywhere now (no slug-based lookup or
-- fallback) — see CLAUDE.md "Content addressing" rule.
DROP INDEX "public"."BlogDetail_slug_key";
DROP INDEX "public"."BlogDetail_slug_idx";
ALTER TABLE "public"."BlogDetail" DROP COLUMN "slug";
