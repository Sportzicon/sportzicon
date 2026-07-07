# PROMPT 13 — Sportzicon Scaling & Architecture Analysis + Upgrade Plan

## Context

Sportzicon is currently a small/regional-scale platform (React 18 + Vite + TS frontend,
Node.js + Express + Prisma + PostgreSQL/Supabase backend, deployed on GCP Cloud Run,
Cloudflare in front for DDoS/WAF/CDN/SSL). Follow all persistent rules in `CLAUDE.md`
(admin role bypass, `ROLES` constants, `pages→hooks→services→api` architecture,
`queryKeys.*`, `humanizeError()`/`AppError`, Prisma-migration-only schema changes,
zero-error build gate, mobile-first 375px/44px touch targets, no breaking changes).

We are planning three major functional expansions and need to prepare the architecture
so each can be added **without a rewrite**, while keeping the app correct and fast at
current scale (100s–low 1,000s of users) and compatible up to mid-size scale
(10K–100K users, 1K–20K DAU, 1K–50K posts/day, 1K–10K+ concurrent live-match viewers).

**This is a planning/analysis task, not an implementation task.** Do not write
feature code in this pass. Output is a single structured markdown plan.

## The three functional areas

### 1. Unified Content (feed/blog/reel/posts → LinkedIn/Instagram-style)
- Replace separate blog/reel/feed functionality with one polymorphic content model:
  a base `Content` table (id, authorId, type: BLOG|REEL|POST, visibility, status,
  denormalized likeCount/commentCount/shareCount, publishedAt) plus one 1:1 detail
  table per type (`BlogDetail`, `ReelDetail`, `PostDetail`).
- Polymorphic engagement tables (`Like`, `Comment`, later `Bookmark`) keyed on
  `contentId`, shared across all content types — build once, not per type.
- No existing production data to migrate/preserve — old blog/reel/feed tables,
  routes, services, and frontend components can be deleted outright and rebuilt,
  not migrated.
- Feed query: single cursor-paginated query against `Content` (join detail tables
  by type), not three separate feed queries merged client-side.
- Feed reads should be cache-friendly (short-TTL Redis cache keyed by user+cursor)
  once traffic grows — structure the query/service now so caching can be added
  later without refactoring the read path.
- One unified composer (creation UI) that branches by type internally, not three
  separate create flows.

### 2. Live Scoring (Cricbuzz/Cricinfo-style)
- Event-sourced model: `MatchEvent` is an append-only, immutable log (one row per
  ball/wicket/over-end/etc., with `sequenceNumber`, `payload` JSON, `voided`,
  `voidedReason`, `correctionOf` fields for corrections/umpire-review reversals).
  Never mutate or delete event rows.
- `MatchState` is a single derived row per match (current score, over, batsmen,
  bowler, `lastEventSequence`) — always produced by replaying non-voided events
  in sequence order, never hand-patched.
- Corrections (e.g. umpire review overturns a decision): void the original event,
  append a `CORRECTION` event referencing it via `correctionOf`, then recompute
  `MatchState` by replaying all non-voided events — all in one DB transaction.
- Broadcast via Socket.io, one room per match (`match:{matchId}`). Requires a
  Redis-backed Socket.io adapter (`@socket.io/redis-adapter`) so broadcasts work
  correctly once Cloud Run scales to multiple instances under popular-match load
  — this is a hard prerequisite before mid-size traffic, not a later nice-to-have.
- `@@unique([matchId, sequenceNumber])` DB constraint to guard against race
  conditions in concurrent event writes; catch-and-retry on violation.

### 3. Historical Match Data & Player Statistics
- Layered aggregation, never live-computed from raw events on a hot path:
  - `MatchSummary` + `PlayerMatchStats` — written once via a batch job triggered
    when a match's status flips to `COMPLETED` (replays that match's own
    `MatchEvent` rows only — bounded, cheap).
  - `PlayerCareerStats` + `PlayerSeasonStats` + `PlayerTournamentStats` — one row
    per player per **format** (T20/ODI/etc., not one row per player overall).
    Updated **incrementally** (add this match's contribution to running totals)
    on match completion, not recomputed from full history each time. Derived
    fields (battingAverage, strikeRate, bowlingAverage, economyRate) stored and
    updated alongside raw counts, not computed on read.
  - `TeamHeadToHead` (normalized team-pair ordering) and `PlayerMilestone`
    (hundreds, five-wicket hauls, hat-tricks) as their own small tables, written
    once at match completion.
  - Idempotency guard (`lastMatchId` / processed-match tracking) on the
    aggregation job so accidental double-triggers don't double-count.
  - Post-completion corrections (rare): compensating adjustment — decrement the
    old contribution, recompute `PlayerMatchStats` for that match from the
    corrected event log, increment the new contribution — using atomic
    increment/decrement operations, not read-modify-write.
- `MatchEvent` should be **partitioned by season/year** from the start (schema
  decision made now, before the table grows — retrofitting partitioning onto an
  existing large table is a much bigger job than defining it upfront).
- Read-path rule to enforce via module boundaries: no user-facing endpoint may
  query raw `MatchEvent` except the batch aggregation job and rare
  full-scorecard/ball-commentary views. Everything else reads `MatchSummary`,
  `PlayerMatchStats`, or the career/season aggregate tables.

### 4. Organizations, Tournaments, Scouts, Athletes & Applications

- Standard CRUD-shaped domain — current architecture (Prisma + role utilities +
  `pages→hooks→services→api` pattern) is largely sufficient here. No new
  infrastructure needed for this area, unlike scoring/Redis. The work is
  correct modeling + linkage into the scoring/stats modules, not new tech.
- **Core entities:**
  - `Organization` (club/academy/franchise) — has many `Scout` (users with
    SCOUT role scoped to that org), has many `Athlete` (roster / represented
    players), organizes `Tournament`s. Include a verification status field
    (`PENDING_VERIFICATION|VERIFIED|SUSPENDED`) since orgs/scouts gatekeep
    athlete data — even if the review process is manual at first.
  - `Tournament` — has many `Team` (each belonging to an `Organization`, or
    standalone), has many `Match`. Format field (knockout/round-robin/league).
  - `Application` — the actual workflow object scouts/athletes interact with
    most: `athleteId`, `organizationId` OR `tournamentId`, `status`
    (PENDING|REVIEWED|ACCEPTED|REJECTED|WITHDRAWN), `appliedAt`, `reviewedBy`,
    `reviewNote`. Model this as an explicit state machine with a small audit
    history table for status transitions — not event-sourced like scoring
    (unnecessary here), but not a bare status flag either.
- **Linkage into the scoring/stats modules (must be wired correctly, not
  bolted on later):**
  - `Match.tournamentId` foreign key — ties the scoring module's matches to a
    tournament.
  - `PlayerTournamentStats` (already defined in the stats layer) depends on
    this linkage existing — it aggregates career-stats-shaped rows scoped to a
    tournament, updated via the same match-completion batch job as
    `PlayerCareerStats`/`PlayerSeasonStats`.
  - New: `TournamentStandings` (teamId, played, won, lost, points,
    netRunRate/pointsDiff) — updated **incrementally** on match completion,
    same pattern as the stats aggregation job, not recomputed from scratch
    each time.
- **Search at volume** — once scouts filter athletes by sport/region/age/stats,
  this becomes a full-text + faceted search problem, not simple `WHERE`
  filtering in application code. Extend the same GIN full-text index pattern
  already used for messaging to `Athlete` (indexed on name, sport, region,
  position, and relevant stats fields). Not urgent at current scale, but
  design the query layer now so adding the index later doesn't mean
  rewriting the service.
- **Module boundary:** `modules/org/` (Organization, Scout verification),
  `modules/tournament/` (Tournament, Team, Standings, Application) — both
  read from `modules/stats/` and `modules/scoring/` via their service
  functions for cross-domain data (e.g. tournament standings pulling match
  results), never via raw cross-schema queries.

### 5. Messaging (existing real-time chat — bring under the same scaling model)

- Messaging already exists (Socket.io-based, long-polling previously replaced,
  single active session enforcement already implemented per current codebase).
  This section is about bringing it under the **same cross-cutting
  infrastructure** as the new scoring module, not rebuilding it.
- **Shares the Redis/Socket.io adapter requirement with scoring** — this is the
  same underlying problem: once Cloud Run scales to multiple instances, a
  message sent by a user connected to instance A won't reach a recipient
  connected to instance B without a shared broadcast layer. The
  `@socket.io/redis-adapter` added for live-scoring in Phase 0/2 should be the
  **same Redis instance and the same Socket.io server setup** serving both
  messaging and scoring rooms/namespaces — do not stand up two separate
  realtime layers.
- Use Socket.io **namespaces or rooms** to separate messaging traffic from
  match-broadcast traffic on the same server (e.g. `/messaging` namespace vs.
  `match:{matchId}` rooms) so the two don't interfere and can be reasoned about
  independently, even though they share the same adapter/instance.
- **Single active session enforcement** — verify this still holds correctly
  once multiple Cloud Run instances are behind the Redis adapter (session
  state must be checked/stored somewhere shared — Redis or DB — not
  in-memory per-instance, or a user could maintain "active" sessions on two
  different instances simultaneously).
- **Message history/read-receipt data** should follow the same read-path
  discipline as historical match data: paginated, indexed (already using
  cursor-based pagination per prior work), and should not be a hot path that
  competes with live delivery — if message search/full-text ever gets added,
  extend the existing GIN index pattern rather than inventing a new one.
- **Presence** (online/offline/typing indicators), if not already handled,
  should be stored in Redis (ephemeral, fast-changing) rather than Postgres —
  this is exactly the kind of hot, transient state Redis is for, distinct from
  durable message records which stay in Postgres.
- **Module boundary:** `modules/messaging/` — should not directly reach into
  `modules/scoring/`'s Socket.io room logic or vice versa; both consume a
  shared low-level realtime/Redis setup (e.g. `lib/realtime/` or similar)
  rather than one module depending on the other.

## Cross-cutting infrastructure needed

- **Database topology:** one Postgres (Supabase) instance — NOT separate databases
  per domain. Use Postgres **schemas** for logical namespacing (`scoring`, `stats`,
  `content`, `identity`, `org`, `tournament`, `messaging`), matched by
  application module boundaries (`modules/scoring/`, `modules/stats/`,
  `modules/content/`, `modules/identity/`, `modules/org/`, `modules/tournament/`,
  `modules/messaging/`). Cross-domain access goes through the owning module's
  service function, never a raw cross-schema query from another module.
- **Read replica:** not needed yet at current scale. Design the stats/history
  service layer so its Prisma client is swappable to a replica connection string
  later with a config change, without touching query logic — but do not
  provision an actual replica in this pass.
- **Redis:** required for (a) a Socket.io cross-instance adapter shared by
  BOTH live scoring and existing messaging (one Redis instance, one Socket.io
  server, separated by namespaces/rooms — not two realtime layers), (b)
  presence/session-state for messaging, (c) future feed-page caching. Add now,
  before mid-size traffic.
- **Postgres connection pooling:** Supavisor/PgBouncer in transaction pooling
  mode — needed before Cloud Run autoscaling under mid-size DAU exhausts direct
  connections.
- **Cloud Run:** keep as a single monolith deployment for now; keep module
  boundaries clean enough that scoring could later be deployed as a separate
  Cloud Run service (same repo, different deploy flag) without a code refactor,
  if live-match traffic ever needs isolation from feed/org traffic. Do not
  actually split deployment in this pass.
- **Cloudflare:** extend existing cache rules to cover reel/image media once
  volume grows — config change, not new setup.

## What I need from you (Claude Code)

1. **Analyze the current codebase** (backend Prisma schema, existing
   blog/reel/feed models and routes, existing messaging/Socket.io setup if any,
   existing services and module structure) and identify exactly what exists
   today vs. what's described above.
2. **Produce a single markdown file** at `docs/SCALING_PLAN.md` (do not
   implement code yet) containing:
   - A gap analysis: current state vs. target state, for each of the three
     functional areas plus the cross-cutting infra items.
   - A concrete, dependency-ordered list of upgrade phases (e.g. Phase 0:
     Redis + connection pooling + module boundary restructuring, shared realtime
     setup for both existing messaging and new scoring; Phase 1: unified
     Content model; Phase 2: event-sourced scoring; Phase 3: historical stats
     aggregation; Phase 4: organizations/tournaments/scouts/athletes/
     applications, including the Match.tournamentId and TournamentStandings
     linkage into scoring/stats; Phase 5: messaging hardening (bring existing
     messaging onto the shared Redis/Socket.io adapter, verify single-session
     enforcement holds across instances, move presence to Redis); Phase 6:
     cross-cutting hardening. Call out which phases block which — note that
     Phase 4's tournament-stats linkage depends on Phase 2/3 existing first,
     and Phase 5 depends on Phase 0's shared realtime layer.
   - For each phase: the specific Prisma models/migrations needed, the specific
     files/modules to delete vs. create vs. modify, and the specific
     acceptance criteria (what "done" looks like, matching the zero-error
     build gate in `CLAUDE.md`).
   - Explicit call-outs of any conflicts with current `CLAUDE.md` master rules
     or existing architecture, and how each is resolved.
   - A short risk/rollback note per phase (given no production data currently
     exists for content, but live scoring and match history — if any already
     exists — may need a real migration path, not a clean drop-and-rebuild).
3. Do **not** write implementation code, do **not** run migrations, do **not**
   modify existing source files in this pass — this prompt is analysis and
   planning only. The output is the `docs/SCALING_PLAN.md` file, structured so
   each phase can later be handed to you as its own standalone implementation
   prompt (PROMPT 14, 15, 16...).
4. Flag anything in this brief that conflicts with what you find in the actual
   codebase (e.g. if blog/reel/feed already have production data, if
   messaging's existing Socket.io/session setup differs from what's assumed
   here, or if match history already has real data) rather than silently
   assuming the brief is fully accurate.

## Output format for docs/SCALING_PLAN.md

```md
# Sportzicon Scaling & Architecture Plan

## Current State Summary
...

## Target State Summary
...

## Phase 0: Foundation
### Goal
### Current vs Needed
### Migrations / Schema Changes
### Files to Create / Modify / Delete
### Acceptance Criteria
### Risks / Rollback

## Phase 1: Unified Content Model
...

## Phase 2: Event-Sourced Live Scoring
...

## Phase 3: Historical Match Data & Player Statistics
...

## Phase 4: Organizations, Tournaments, Scouts, Athletes & Applications
...

## Phase 5: Messaging Hardening (shared Redis/Socket.io adapter, session/presence)
...

## Phase 6: Cross-Cutting Hardening (pooling, partitioning, module boundaries)
...

## Open Questions / Conflicts Found in Codebase
...
```
