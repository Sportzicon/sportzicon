-- GIN index on athlete_data JSONB column for efficient JSON path queries.
-- Short-term fix pending full ARCH-008 migration (structured columns).
-- Note: no CONCURRENTLY — Prisma migrations run inside a transaction,
-- and PostgreSQL prohibits CONCURRENTLY inside a transaction block.

CREATE INDEX IF NOT EXISTS athlete_data_gin
ON "User" USING GIN (athlete_data jsonb_path_ops)
WHERE athlete_data IS NOT NULL;
