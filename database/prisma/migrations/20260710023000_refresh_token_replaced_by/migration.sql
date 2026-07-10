-- Refresh-token rotation was a plain delete+create, which throws
-- "record to delete does not exist" when two requests race to rotate the
-- same (single-use) refresh token concurrently — e.g. multiple tabs, or
-- several 401s firing at once. The loser's error was surfacing to the
-- client as a failed refresh and forcing a full logout of a valid session.
--
-- replaced_by_token lets the rotation logic use an atomic compare-and-swap
-- (UPDATE ... WHERE revoked = false) instead of delete+create: the loser of
-- the race can look up the winner's replacement token and reuse it instead
-- of failing outright.

ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "replaced_by_token" TEXT;
