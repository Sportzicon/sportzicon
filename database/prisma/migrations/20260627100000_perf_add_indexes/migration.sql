-- Performance: indexes for common query patterns

-- User: admin search by name, role filtering
CREATE INDEX IF NOT EXISTS "User_full_name_lower_idx" ON "User"("full_name_lower");
CREATE INDEX IF NOT EXISTS "User_status_created_at_idx" ON "User"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");

-- Organization: owner lookup (used in listMyOpportunities, listOrganizationsForOwner)
CREATE INDEX IF NOT EXISTS "Organization_owner_user_id_created_at_idx" ON "Organization"("owner_user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Organization_org_name_lower_idx" ON "Organization"("org_name_lower");
CREATE INDEX IF NOT EXISTS "Organization_verification_status_idx" ON "Organization"("verification_status");

-- Reel: feed pagination
CREATE INDEX IF NOT EXISTS "Reel_author_id_created_at_idx" ON "Reel"("author_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Reel_created_at_idx" ON "Reel"("created_at" DESC);

-- Blog: author feed, slug lookup
CREATE INDEX IF NOT EXISTS "Blog_author_id_created_at_idx" ON "Blog"("author_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Blog_slug_idx" ON "Blog"("slug");

-- Report: status filtering
CREATE INDEX IF NOT EXISTS "Report_status_created_at_idx" ON "Report"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Report_reporter_id_idx" ON "Report"("reporter_id");

-- Verification: status filtering
CREATE INDEX IF NOT EXISTS "Verification_status_created_at_idx" ON "Verification"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "Verification_submitted_by_idx" ON "Verification"("submitted_by");
CREATE INDEX IF NOT EXISTS "Verification_entity_id_idx" ON "Verification"("entity_id");
