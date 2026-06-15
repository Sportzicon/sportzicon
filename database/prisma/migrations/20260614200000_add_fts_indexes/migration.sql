-- Add full-text search vectors for PostgreSQL FTS (ARCH-004 fix)
-- search_vector columns are managed by triggers; not tracked by Prisma schema.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- GIN indexes for fast tsvector lookups
CREATE INDEX IF NOT EXISTS user_fts_idx ON "User" USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS org_fts_idx ON "Organization" USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS opp_fts_idx ON "Opportunity" USING GIN(search_vector);

-- Trigger: auto-update User.search_vector on insert/update
CREATE OR REPLACE FUNCTION user_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.full_name, '') || ' ' ||
    coalesce(NEW.bio, '') || ' ' ||
    coalesce(NEW.city, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_search_vector_trigger ON "User";
CREATE TRIGGER user_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION user_search_vector_update();

-- Trigger: auto-update Organization.search_vector on insert/update
CREATE OR REPLACE FUNCTION org_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.org_name, '') || ' ' ||
    coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS org_search_vector_trigger ON "Organization";
CREATE TRIGGER org_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Organization"
  FOR EACH ROW EXECUTE FUNCTION org_search_vector_update();

-- Trigger: auto-update Opportunity.search_vector on insert/update
CREATE OR REPLACE FUNCTION opp_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS opp_search_vector_trigger ON "Opportunity";
CREATE TRIGGER opp_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "Opportunity"
  FOR EACH ROW EXECUTE FUNCTION opp_search_vector_update();

-- Backfill existing rows
UPDATE "User" SET search_vector = to_tsvector('english',
  coalesce(full_name, '') || ' ' ||
  coalesce(bio, '') || ' ' ||
  coalesce(city, ''))
WHERE search_vector IS NULL;

UPDATE "Organization" SET search_vector = to_tsvector('english',
  coalesce(org_name, '') || ' ' ||
  coalesce(description, ''))
WHERE search_vector IS NULL;

UPDATE "Opportunity" SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, ''))
WHERE search_vector IS NULL;
