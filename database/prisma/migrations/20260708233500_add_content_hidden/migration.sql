-- Explicit hide/unhide for content, independent of blog draft/published
-- status. Hidden content is excluded from the Catch feed regardless of
-- viewer (including the author's own Catch view), but still visible on the
-- author's own profile feed with a "Hidden" indicator.
ALTER TABLE "public"."Content" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
