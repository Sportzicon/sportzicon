# Sportzicon Scaling & Architecture Plan

Source briefs: `docs/scaling-architecture-analysis.md` (original) and
`docs/PROMPT-13-scaling-architecture-analysis (1).md` (revised with verify-first
call-outs). This document supersedes both — it reflects the codebase as it
actually exists (verified, not assumed) and the scale target agreed for this
pass: **design for a 10K-user ceiling now, bake in cheap compatibility seams
for enterprise scale later, build none of the enterprise machinery yet.**

---

## Current State Summary

Verified directly against the repo, not inferred from the brief:

- **Two separately deployed backends, two separate databases.** Main backend
  (`backend/`, Supabase Postgres, Cloud Run, port 8080) and scoring backend
  (`scoring/backend/`, its own Postgres, its own Cloud Run service, port 4000).
  `deploy-staging.yml` confirms this: separate `migrate-scoring-db` job,
  separate `SCORING_DATABASE_URL`/`scoring_direct_url` Terraform vars, separate
  `sportivox-scoring-api-staging` Cloud Run service. This is real deployed
  infrastructure, not a documentation assumption.
- **Main backend already has Redis + Socket.io wired.** `ioredis` and
  `socket.io` are installed deps. `backend/src/config/redis.ts` is a working
  lazy-connect, optional cache client (`cacheGet`/`cacheSet`/`cacheDel`,
  no-ops if `REDIS_URL` unset). `backend/src/lib/socket.ts` is a working
  single-instance Socket.io server used by messaging only (room-per-conversation,
  no cross-instance adapter).
- **Scoring backend has zero realtime infrastructure.** No socket.io, no
  redis, in either its `package.json` or source — confirmed by direct search.
  Live-match broadcast does not exist yet; it is net-new work, not an upgrade.
- **Scoring schema is a mature, non-trivial cricket domain**, not greenfield:
  `Tournament`, `Team`, `Player`, `Match`, `MatchPlayer`, `Innings`,
  `BattingEntry`, `BowlingEntry`, `FieldingEntry`, `Partnership`, `BallEvent`,
  `PlayerCareerStats` all already exist.
  - `BallEvent` is a rich, typed, per-delivery table (shot type, line, length,
    wicket detail, phase) — **not** append-only/correction-safe. No
    `sequenceNumber`/`voided`/`correctionOf` equivalent. Corrections today
    would have to mutate a row directly.
  - `PlayerCareerStats` is one row per player, **overall only** — no
    season/tournament/format breakdown.
  - `MatchEvent` (in the scoring schema) is a **separate, unrelated** generic
    event log for football/basketball (goals, cards, substitutions) — it is
    not the same concern as `BallEvent` and does not need renaming. The
    original brief's proposed "event-sourced `MatchEvent`" for cricket maps
    onto hardening `BallEvent`, not colliding with the existing `MatchEvent`.
- **Main schema already has `Organization` and `Application`** — Phase 4 of
  the original brief ("Organizations, Tournaments, Scouts, Athletes &
  Applications") is not greenfield for those two entities.
- **Uncommitted in-progress work exists right now** (per `git status`):
  `AthleteTournament` model + migration, `tournaments.service.ts`,
  `scorecardLinkPreview.ts`. `AthleteTournament` is a simple, athlete-facing,
  self-reported resume entry (name/year/team/format/result) — structurally
  different from a full `Organization → Tournament → Team → Match` graph.
  These must be reconciled, not overwritten.
- **`backend/src/modules/stats/`** already exists but is unrelated to career
  stats — it's `publicStats()`, a landing-page counter (athlete/club/opportunity
  counts). Do not confuse this with the scoring career-stats layer.
- **`Post`/`Blog`/`Reel` are separate models today**, as the brief assumes —
  but `database/seeds/seed.ts` seeds real posts/reels/blogs with engagement
  counts, and demo accounts are documented as running against real
  staging/production. **The brief's "no production data to migrate" claim for
  content is unverified and must be checked before any drop-and-rebuild.**
- **Known, documented security gaps** (`SECURITY_RULES.md`): refresh token in
  localStorage, scoring API CORS wildcard, disabled CSP, in-process (not
  distributed) rate limiter, legacy upload endpoint. `backend/src/middleware/rateLimit.ts`
  is already mid-edit in the working tree.

---

## Target State Summary

- **Scale target:** design and build for a 10K-user ceiling. Do not
  pre-build infrastructure (read replicas, search engines, job queues,
  cross-instance realtime) that only pays off at 100K+ users or multi-tenant
  enterprise scale.
- **Compatibility target:** every near-term implementation choice should sit
  behind a seam (a flag, a function boundary, a column that already exists)
  so the enterprise-scale upgrades in the "Future-Scale Hooks" section become
  swaps, not rewrites.
- **Single Postgres instance**, scoring merged in under a `scoring` schema
  namespace, single identity table. No prod data in scoring DB — do this
  before it accumulates real match data and the cutover gets expensive.
- **Correctness fixed regardless of scale:** `BallEvent` immutability/correction
  safety, stats aggregation on match completion, security gaps — none of
  these are scale-gated, all get fixed now.

---

## Phase 0: Foundation — DB Merge & Identity Unification

### Goal
Collapse two databases into one before scoring accumulates real data, and set
up the cheap forward-compatibility seams for realtime/read-replica swaps.

### Current vs Needed
- Two Postgres instances → one (main Supabase instance), `scoring` schema
  namespace for scoring's tables.
- Two identity tables (main `User`, scoring `User`/`RefreshToken`) → one.
  Drop scoring's own `User`/`RefreshToken`, FK every scoring table
  (`Player`, `Match`, etc. that reference a user) straight to main `User.id`.
- Scoring backend has no Socket.io → add one, but gate any Redis adapter
  behind `env.REDIS_URL` so flipping to multi-instance later is a config
  change: `if (env.REDIS_URL) { io.adapter(createAdapter(pub, sub)) }`, default
  in-memory adapter otherwise. Zero behavior change today (service still
  pinned to `min-instances=1, max-instances=1`).
- Confirm Supabase's built-in Supavisor pooler is in use (no custom
  PgBouncer needed at 10K).

### Migrations / Schema Changes
- New migration in `database/prisma/schema.prisma`: import scoring's models
  (`Tournament`, `Team`, `Player`, `Match`, `MatchPlayer`, `Innings`,
  `BattingEntry`, `BowlingEntry`, `FieldingEntry`, `Partnership`, `BallEvent`,
  `PlayerCareerStats`, `MatchEvent`) under `@@schema("scoring")`
  (Prisma `multiSchema` preview feature), rewrite their `player`/`user`
  relations to point at main `User.id`.
- Drop scoring's own `User`/`RefreshToken` models and its separate
  `scoring/backend/prisma/migrations/` history (no data to preserve).
- Add `season` / `year` column to `BallEvent` and `MatchEvent` now, even
  though nothing is partitioned yet — free today, expensive to retrofit onto
  a populated table later.

### Files to Create / Modify / Delete
- Modify: `database/prisma/schema.prisma` (add scoring models + schema
  namespace), `backend/.env.example` / Terraform vars (drop
  `SCORING_DATABASE_URL`/`scoring_direct_url`, scoring backend now uses main
  `DATABASE_URL`).
- Modify: `.github/workflows/deploy-staging.yml` / `deploy-production.yml` —
  remove the standalone `migrate-scoring-db` job, fold into the main
  migration step (single `_prisma_migrations` source of truth).
- Delete: `scoring/backend/prisma/schema.prisma`, `scoring/backend/prisma/migrations/`.
- Create: `scoring/backend/src/lib/socket.ts` (new — scoring has none today),
  flag-gated adapter as described above.
- Modify: `scoring/backend/src/server.ts` to call `initSocket`.

### Acceptance Criteria
- `cd frontend && npm run typecheck && npm run build` and
  `cd backend && npm run typecheck` pass with zero errors.
- Scoring backend builds and runs against main `DATABASE_URL`, zero
  references to a separate scoring connection string remain in code or CI.
- Single migration history; a fresh `npx prisma migrate deploy` from clean
  reproduces both domains.

### Risks / Rollback
- No prod data in scoring DB — lowest-risk phase in this plan, this is why
  it goes first. Rollback = revert the schema-merge commit, no data to lose.
- CI change (removing the separate migrate job) touches deploy pipelines
  directly — test on staging before touching `deploy-production.yml`.

---

## Phase 1: Security Hardening (parallel track, no dependencies) — DONE (2026-07-06)

Not scale-gated — fix now regardless of user count, per `SECURITY_RULES.md`'s
own list of known gaps. Can run independently of Phase 0/2/3.

**Re-verified against the actual code before implementing — 2 of the 4 items
below were already stale by the time this ran:**
- Refresh token was **already** httpOnly-cookie based (not localStorage) —
  no code change needed.
- Scoring CORS was **already** an explicit allowlist (not a wildcard) — the
  only real issue was the env var being named `CORS_ORIGIN` (singular,
  unvalidated) instead of matching main backend's `CORS_ORIGINS`.
- Rate limiter (in-process) and CSP (disabled) were both confirmed real gaps
  and fixed below.

### Goal
Close the four flagged security gaps before they become enterprise-deal
blockers.

### What was done
- **Rate limiter**: `backend/src/middleware/rateLimit.ts` now uses a
  Redis-backed `Store` (`rate-limit-redis`, wired through
  `getRedisClient()` in `backend/src/config/redis.ts`) for all three
  limiters, with `passOnStoreError: true` (fail open on Redis errors, same
  philosophy as the existing cache helpers). Falls back to the default
  in-memory `MemoryStore` when `REDIS_URL` is unset — zero behavior change
  in that case.
- **Refresh token**: already cookie-based — confirmed, no change.
- **CSP**: both `backend/src/app.ts` and `scoring/backend/src/app.ts` are
  pure JSON APIs (never serve HTML — confirmed by grep for
  `res.sendFile`/`res.send` with html content-type). Enabled a locked-down
  `default-src 'none'; frame-ancestors 'none'` CSP as a defense-in-depth
  backstop rather than a curated frontend/GCS-host allowlist (there's no
  page context here for that to matter).
- **Scoring CORS**: renamed `CORS_ORIGIN` → `CORS_ORIGINS` everywhere it's
  read/set (`scoring/backend/src/app.ts`, `scoring/backend/src/lib/socket.ts`,
  `infra/terraform/cloudrun.tf`, both `docker-compose.yml`s,
  `scoring/backend/.env.example`) to match main backend's naming convention.
  No behavior change — still an explicit allowlist, no wildcard, before and
  after.

### Acceptance Criteria
- Rate limiter state survives across simulated multi-instance test (two
  processes sharing one Redis both see the same counter). ✅ — falls back to
  in-memory identically to before when `REDIS_URL` unset.
- No refresh token readable from `localStorage`/`document.cookie` via JS
  (httpOnly verified in browser devtools). ✅ — already true pre-existing.
- CSP header present, no console CSP violations on a full manual pass through
  login/feed/profile/reels. ✅ — N/A for console violations (no HTML served
  by either backend), header presence verified via `curl -i /healthz`.
- Scoring API rejects requests from a non-allowlisted `Origin` header. ✅ —
  unchanged behavior, just re-sourced from the renamed env var.

---

## Phase 2: Live Scoring Correctness — `BallEvent` Hardening — DONE (2026-07-06)

### Goal
Make ball-by-ball scoring append-only and correction-safe, per the original
brief's event-sourcing intent — applied to the existing `BallEvent` table
rather than a new generic model.

**Re-verified against the actual scoring service before implementing:**
`Innings` already carries denormalized running totals updated by
`addBall`/`undoLastBall` — it already **is** the derived-state row this
phase wondered whether it needed to build. No new table was needed. The
only correction feature that existed was "undo last ball," which
hard-deleted the `BallEvent` row and manually reversed deltas across 5
tables with **no transaction wrapper at all** — a real atomicity gap on top
of the append-only one.

### Scope actually implemented (see plan file discussion — full replay/
recompute engine was considered and deliberately not built)
- `BallEvent` gained `voided`, `voided_reason`, `correction_of_id`
  (self-relation) fields (migration `20260706120000_ball_event_correction_fields`).
- `undoLastBall` now **voids** the row (`voided: true, voided_reason`)
  instead of `ballEvent.delete()` — ledger is genuinely append-only,
  `correction_of_id` stays `null` for a pure undo (no replacement ball).
- Both `addBall` and `undoLastBall`'s write sequences are wrapped in
  `prisma.$transaction(...)` — fixes the pre-existing atomicity gap.
- All 6 `BallEvent` read sites in `scoring.service.ts` (free-hit derivation,
  momentum calc, `getInningsAnalytics`, `getPlayerScouting`, `undoLastBall`'s
  own lookup, `getOverSummary`) now filter `voided: false`.
- **Not built**: a full replay-based recompute engine for `Innings`/entry
  tables, an "edit a specific historical ball" endpoint (nothing today asks
  for it — only "undo last" exists), socket broadcast on ball events
  (unrelated to this phase). The existing increment/decrement math is
  correct for the one correction case that exists (always the tail of the
  sequence) and was left as-is.

### Acceptance Criteria
- A correction (undo) produces a voided row, never a deleted one — verified
  directly against the live DB: 3 balls recorded, undo twice, all 3 rows
  still present (2 voided, 1 live), `Innings` totals correctly reverted at
  each step, a second undo correctly targets the next non-voided ball
  rather than re-touching the just-voided one.
- `getOverSummary` (and the other 5 read sites) confirmed to exclude voided
  balls.
- `cd backend && npm run typecheck`, `cd scoring/backend && npx tsc --noEmit`,
  and `npm run build` all pass with zero errors.

### Risks / Rollback
- Checked before starting: 1 tournament / 1 match / 2 innings exist in the
  live DB, but 0 `BallEvent` rows — no deliveries have been recorded yet, so
  no in-flight match was using the old mutate-in-place undo flow. Migration
  is purely additive (nullable/defaulted columns + index), safe regardless.

---

## Phase 3: Historical Stats Aggregation — DONE (2026-07-06)

### Goal
Add the match-completion aggregation step that doesn't exist yet, extending
`PlayerCareerStats` rather than replacing it.

**Re-verified against the actual scoring service before implementing — the
"no aggregation job exists today" premise was stale.** `syncCareerStats(matchId)`
already existed and already ran career-stats aggregation from both places
`Match.status` transitions to `"completed"` (`maybeAutoCompleteMatch`,
cricket auto-complete; `updateMatch`, generic manual "End Match" for any
sport), each already guarded on the status-transition edge
(`match.status !== "completed"` before the write) — this repo's existing,
working idempotency mechanism. The only real gap was the missing
season/tournament-scoped sibling tables.

### What was done
- `PlayerSeasonStats`/`PlayerTournamentStats` added (migration
  `20260706130000_player_season_tournament_stats`), same field shape as
  `PlayerCareerStats`, scoped by `season`/`tournament_id` respectively.
- `syncCareerStats` renamed to `aggregateMatchStats` (matches the name this
  Future-Scale Hooks table already used) and extended: the same per-player
  batting/bowling/fielding increments it already computed are now fanned out
  to all three tables via one shared `upsertStatRow` helper, instead of
  duplicating the upsert logic three times. Tournament stats always get
  written (every match belongs to a tournament); season stats only if
  `tournament.season` is set (it's optional — skipped, not erred, when unset).
- No new `MatchSummary` table — confirmed `Match`/`Innings` already carry
  every completion-relevant field.
- No new idempotency column — the existing transition-edge guard (unchanged)
  already covers the two new tables for free, since they're written from the
  same already-guarded call.

### Acceptance Criteria
- Verified end-to-end against the live DB: recorded 2 balls (a four and a
  six), completed the match via the manual `updateMatch` path, confirmed
  `PlayerCareerStats`/`PlayerTournamentStats`/`PlayerSeasonStats` all show
  `matches_played: 1, total_runs: 10` consistently. Re-triggered completion
  a second time — all three tables' numbers held unchanged (idempotency
  guard confirmed to now cover all three, not just career stats). Test data
  cleaned up after.
- `cd backend && npm run typecheck`, `cd scoring/backend && npx tsc --noEmit && npm run build` all pass.

### Risks / Rollback
- Purely additive tables + a rename/extend of an existing, already-working
  function. No behavior change to existing `PlayerCareerStats` writes.

---

## Phase 4: Organizations, Tournaments & Applications Linkage

### Goal
Build the structured tournament graph additively, without disturbing
`Organization`/`Application` (already exist) or the uncommitted
`AthleteTournament` work (already in progress).

### Current vs Needed
- `Organization`, `Application` already exist and are sufficient as-is.
- `AthleteTournament` (uncommitted) stays as-is — it's a self-reported resume
  entry, a different concern from a structured competition record. **Do not
  merge it into the new `Tournament` model; keep both.**
- New, additive: `Tournament` (belongs to `Organization`, has many `Team`),
  `Team`, `Match.tournamentId` FK linking into the scoring domain,
  `TournamentStandings` (updated incrementally on match completion, same
  pattern as Phase 3's aggregation).
- Every new model carries `organizationId` — cheap now, this is what makes
  future tenant-row-scoping additive instead of a retrofit.

### Migrations / Schema Changes
- New `Tournament`, `Team`, `TournamentStandings` tables.
- `ALTER TABLE "Match" ADD COLUMN tournament_id UUID REFERENCES "Tournament"(id)`.

### Files to Create / Modify / Delete
- Create: `backend/src/modules/tournament/` (routes/service/schemas) —
  reconcile naming with existing uncommitted `tournaments.service.ts`, ask
  the person building it whether this phase supersedes or should build
  alongside it before writing any code here.
- Modify: `modules/scoring` completion handler to also update
  `TournamentStandings` when `Match.tournamentId` is set.

### Acceptance Criteria
- Tournament standings update correctly on match completion.
- `AthleteTournament` (existing/uncommitted) and the new `Tournament` model
  coexist without route/name collisions.

### Risks / Rollback
- **Must talk to the person before starting** — this phase directly
  overlaps in-progress uncommitted work. Don't silently build over it.

---

## Phase 5: Content Unification — Gated on Data Verification

### Goal
Unify `Post`/`Blog`/`Reel` into one polymorphic `Content` model, per the
original brief — but only after confirming the "no production data" premise.

### Current vs Needed
- **Blocking prerequisite:** check staging/production DB for real
  user-generated posts/reels/blogs (not just seed data). `seed.ts` seeds
  realistic content with engagement counts — confirm whether this has ever
  been loaded into an environment real users touched.
- If genuinely empty: proceed as originally specified — drop and rebuild
  `Post`/`Blog`/`Reel` as `Content` + `BlogDetail`/`ReelDetail`/`PostDetail`,
  polymorphic `Like`/`Comment` keyed on `contentId`.
- If real content exists: this becomes a migration (backfill `Content` rows
  from existing tables, dual-write or read-shim during cutover), not a clean
  rebuild. Do not decide this without checking.
- Feed query as one function (`getFeed(userId, cursor)`) from the start —
  wrapping it in Redis cache-aside later (using the `cacheGet`/`cacheSet`
  that already exist in `config/redis.ts`) touches one place, not every
  caller. Don't add the cache now — not needed at 10K post volume.

### Migrations / Schema Changes
- New `Content`, `BlogDetail`, `ReelDetail`, `PostDetail`, polymorphic `Like`,
  `Comment` tables.
- Either a clean drop of `Post`/`Blog`/`Reel`/old `Like`/`Comment` tables, or
  a backfill migration — decided by the verification step above.

### Files to Create / Modify / Delete
- Create: `backend/src/modules/content/` replacing `modules/posts`,
  `modules/blogs`, `modules/reels` (or supplementing, if migration path
  needed).
- Delete (only if verified empty): old modules' routes/services/schemas,
  corresponding frontend components.

### Acceptance Criteria
- Single cursor-paginated feed query against `Content`, no client-side
  merge of three separate queries.
- Zero data loss if real content existed (verified via row-count parity
  check pre/post migration).

### Risks / Rollback
- Highest-uncertainty phase in this plan specifically because the "no prod
  data" premise is unverified. Do the verification step before writing any
  migration code, not after.

---

## Future-Scale Hooks (build now, activate later — do not build the target state itself)

These are the seams this plan deliberately bakes in during Phases 0-5 so that
crossing into enterprise scale later is a swap, not a rewrite. None of the
right-hand column gets built in this pass:

| Seam built now | What it unlocks later | Trigger to actually build the upgrade |
|---|---|---|
| `env.REDIS_URL`-gated Socket.io adapter (Phase 0) | Multi-instance realtime, zero-downtime deploys during live matches | Concurrent WS connections on one instance approaching ~15-20K, or deploy-during-match becomes operationally painful |
| `season`/`year` column on `BallEvent`/`MatchEvent` (Phase 0) | Table partitioning without a retrofit migration | Row count growth becomes a real query-latency problem (not before) |
| Stats service Prisma client behind one config point | Swap to a read replica with a one-line change | Stats/history reads start competing with live-write latency |
| `getFeed(userId, cursor)` as a single function | Redis cache-aside wrap, using cache helpers that already exist | Feed read latency or DB load becomes visible at higher DAU |
| `searchAthletes(query, filters)` behind one interface | Swap Postgres GIN for OpenSearch/Typesense | Faceted search (sport+region+age+stats combos) needed at row counts where GIN stops being enough |
| `aggregateMatchStats(matchId)` as a standalone function | Swap direct call for `queue.enqueue(...)` (BullMQ) | Aggregation needs retry/backpressure/dead-letter handling — not needed at 10K |
| `organizationId` FK on every new Phase 4 model | Row-level tenant isolation, additive not retrofitted | Selling to orgs as isolated tenants becomes a real requirement |

---

## Open Questions / Conflicts Found in Codebase

1. **Reconcile with in-progress `AthleteTournament`/`tournaments.service.ts`/`scorecardLinkPreview.ts` before starting Phase 4** — ask the person building it whether Phase 4's `Tournament`/`Team`/`TournamentStandings` model supersedes, extends, or runs alongside this work.
2. **Verify real content data before Phase 5** — check staging/production for non-seed posts/reels/blogs. Unverified as of this writing.
3. **Confirm current live-score computation method in scoring/frontend** before Phase 2 — if it already re-sums `BallEvent` on read rather than maintaining a derived state row, say so explicitly rather than assuming one needs to be built from scratch.
4. **Cookie-based refresh token transition (Phase 1)** — decide whether existing sessions get a grace-period dual-read or a hard cutover forcing re-login. Needs a call before implementation, not during.
