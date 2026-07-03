-- Fix ARCH-004 follow-up: Organization and Opportunity search_vector triggers
-- never included city, so searching by city in the main keyword box returned
-- no clubs/opportunities (only the separate City filter LIKE worked).

CREATE OR REPLACE FUNCTION org_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.org_name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.city, '') || ' ' ||
    coalesce(NEW.state, '') || ' ' ||
    coalesce(NEW.country, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION opp_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.city, '') || ' ' ||
    coalesce(NEW.state, '') || ' ' ||
    coalesce(NEW.country, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing rows so already-created orgs/opportunities become
-- searchable by city immediately (trigger only fires on insert/update).
UPDATE "Organization" SET search_vector = to_tsvector('english',
  coalesce(org_name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(city, '') || ' ' ||
  coalesce(state, '') || ' ' ||
  coalesce(country, ''));

UPDATE "Opportunity" SET search_vector = to_tsvector('english',
  coalesce(title, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(city, '') || ' ' ||
  coalesce(state, '') || ' ' ||
  coalesce(country, ''));
