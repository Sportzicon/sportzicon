# Architectural Flaw Register — Sportivox / Sportzicon

**Version:** 1.0  
**Date:** 2026-06-07  
**Status:** Current  

This register documents confirmed architectural flaws in the current codebase. Each entry is specific, technical, and tied to observable code behavior. Flaws are numbered ARCH-001 through ARCH-010 and are ordered by recommended remediation priority.

---

## Summary Table

| ID       | Title                                      | Severity | Effort | Priority |
|----------|--------------------------------------------|----------|--------|----------|
| ARCH-001 | Stale README / Firestore Reference         | Low      | S      | 5        |
| ARCH-002 | Denormalised Counter Race Condition        | High     | M      | 2        |
| ARCH-003 | Conversation Model Limits to 1:1 Only      | Medium   | L      | 7        |
| ARCH-004 | In-Memory Search Filtering                 | High     | L      | 3        |
| ARCH-005 | Polling-Based Real-Time (No WebSocket)     | High     | XL     | 4        |
| ARCH-006 | Partial Repository Pattern Coverage        | Medium   | L      | 8        |
| ARCH-007 | No Caching Layer                           | Critical | M      | 1        |
| ARCH-008 | JSON Blobs for Role-Specific User Data     | Medium   | XL     | 9        |
| ARCH-009 | Scoring Subsystem Data Isolation           | Medium   | XL     | 10       |
| ARCH-010 | Client-Side Opportunity Sort and Filter    | High     | M      | 6        |

---

## ARCH-001 — Stale README / Firestore Reference

**Severity:** Low  
**Effort:** S (Small — hours)  
**Priority:** 5

### Current Behavior

The original `README.md` referred to Firestore as the application database. The actual database is PostgreSQL, managed via Prisma ORM and hosted on Supabase in production. No Firestore dependency exists anywhere in `package.json`, `backend/`, or `database/`. The README also omitted the scoring subsystem, the correct port numbers, the GCS media architecture, and the JWT auth scheme.

### Impact

New engineers joining the project receive incorrect information about the data layer. A developer who reads the README before exploring the codebase may waste significant time looking for Firestore configuration, Firebase admin SDK setup, or collection-based query patterns that do not exist. Trust in the documentation as a whole is undermined.

### Root Cause

The README was written early in the project and was not updated as the tech stack was finalised. No documentation review gate exists in the CI/CD pipeline.

### Recommended Fix

Rewrite the README entirely (delivered as part of this document set). Add a CI check — a simple grep for known stale terms — that fails the PR build if the README contains prohibited strings such as "Firestore", "Firebase", or "collection". Going forward, require README updates as part of the definition of done for any PR that changes the technology stack.

---

## ARCH-002 — Denormalised Counter Race Condition

**Severity:** High  
**Effort:** M (Medium — days)  
**Priority:** 2

### Current Behavior

The schema stores denormalised counters directly on content entities:
- `Post.like_count`, `Post.comment_count`, `Post.view_count`
- `Reel.like_count`, `Reel.comment_count`, `Reel.view_count`
- `Blog.like_count`, `Blog.comment_count`
- `User.follower_count`, `User.following_count`
- `Opportunity.application_count`

When a like is created, the service performs two operations inside a Prisma transaction:
```typescript
// Approximate current pattern in posts service
await prisma.$transaction([
  prisma.postLike.create({ data: { postId, userId } }),
  prisma.post.update({
    where: { id: postId },
    data: { like_count: { increment: 1 } }
  })
]);
```

Prisma's `{ increment: 1 }` compiles to `SET like_count = like_count + 1` in SQL, which is safe for single-row updates. However, at the application layer, the service may first read the post, perform validation checks, and then update — creating a read-modify-write gap. Under concurrent requests from multiple clients liking the same post simultaneously, if the service layer reads `like_count = 100`, validates, and then another request also reads `like_count = 100` and both write `101`, one increment is lost.

### Impact

Like counts, follower counts, and application counts become inaccurate under concurrent load. The severity depends on traffic volume. At low traffic, the probability of collision is negligible. At social-media scale (hundreds of concurrent likes on a viral post), counts can diverge significantly from the true value in the `PostLike` join table.

### Root Cause

The read-validate-write pattern in the service layer — common for checking duplicate likes before creating the `PostLike` record — introduces a window between the duplicate check and the counter increment. The Prisma `increment` itself is atomic at the SQL level, but the surrounding transaction includes the duplicate check read, breaking strict serializability.

### Recommended Fix

**Option A (Minimal change):** Move entirely to `prisma.$executeRaw` with a single atomic SQL statement that performs the insert and increment in one operation using `ON CONFLICT DO NOTHING` with a returning clause:
```sql
WITH ins AS (
  INSERT INTO "PostLike" (post_id, user_id)
  VALUES ($1, $2)
  ON CONFLICT DO NOTHING
  RETURNING 1
)
UPDATE "Post"
SET like_count = like_count + (SELECT COUNT(*) FROM ins)
WHERE id = $1;
```

**Option B (Preferred for scale):** Remove denormalised counters from hot write paths. Compute counts with `COUNT(*)` queries backed by database indexes, and cache the result in Redis with a short TTL (e.g., 60 seconds). This trades slightly stale counts for correctness and eliminates the race entirely.

---

## ARCH-003 — Conversation Model Limits to 1:1 Messaging Only

**Severity:** Medium  
**Effort:** L (Large — weeks)  
**Priority:** 7

### Current Behavior

The `Conversation` model stores participants as a `String[]` (PostgreSQL array column) on the `Conversation` record:
```prisma
model Conversation {
  id              String   @id @default(uuid())
  participant_ids String[]
  last_message    Json?
  unread_counts   Json?
  messages        Message[]
}
```

The `Message` model includes both `sender_id` and `recipient_id`, implying a strictly two-party design:
```prisma
model Message {
  sender_id    String
  recipient_id String
}
```

Messaging service logic creates a conversation by finding or creating a `Conversation` where `participant_ids @> ARRAY[$userId1, $userId2]` — a 2-element array check. There is no UI or API to add a third participant, and the `unread_counts` JSON object uses a two-key structure keyed by the two participant IDs.

### Impact

The platform cannot support group chats between an athlete, a coach, and a club scout — a natural use case in sports recruitment. Tournaments with multiple organizers cannot have a shared communication channel. The data model would require a non-trivial migration to support group conversations in the future.

### Root Cause

The initial design optimised for simplicity (1:1 DMs), and the `String[]` storage choice deferred the problem to later. Using an array on the parent model instead of a proper join table (`ConversationParticipant`) is the core issue.

### Recommended Fix

Introduce a proper `ConversationParticipant` join table:
```prisma
model ConversationParticipant {
  conversation_id String
  user_id         String
  unread_count    Int    @default(0)
  joined_at       DateTime @default(now())
  conversation    Conversation @relation(...)
  user            User @relation(...)
  @@id([conversation_id, user_id])
}
```

Remove `participant_ids String[]` and `unread_counts Json` from `Conversation`. Migrate `last_message Json` to a proper `last_message_id` FK. This is a breaking schema migration requiring a data migration script.

---

## ARCH-004 — In-Memory Search Filtering

**Severity:** High  
**Effort:** L (Large — weeks)  
**Priority:** 3

### Current Behavior

The search module (`backend/src/modules/search/`) implements Phase-1 search as SQL `LIKE` queries followed by in-memory filtering in Node.js. The pattern is approximately:

```typescript
// Approximate current pattern in search service
const candidates = await prisma.user.findMany({
  where: {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { athlete_data: { path: ['sport'], string_contains: query } }
    ]
  },
  take: limit * 3,  // fetch 3x to compensate for in-memory filter drop-off
});

// Apply additional filters in Node.js (role, sport, location)
const filtered = candidates.filter(u => matchesFilters(u, filters));
return filtered.slice(0, limit);
```

The service fetches three times the requested limit from the database, applies additional filters in Node.js memory, and returns the final page. No full-text search index exists on any table.

### Impact

At small user bases (< 1,000 users), this is acceptable. At 10,000 users, the query returns 300 rows over the wire for a page of 100 results — a 3x data transfer overhead. At 100,000 users, the `take: limit * 3` heuristic fails (the filtered result set drops below the requested limit), and the `LIKE` query performs a full sequential scan because LIKE with a leading wildcard (`%term%`) does not use a B-tree index.

### Root Cause

Search was explicitly scoped to Phase 1 (SQL + in-memory) to defer the complexity of full-text search infrastructure. The 3x over-fetch is a known workaround for the filter drop-off problem with no automatic recalibration.

### Recommended Fix

**Phase 2 (Recommended immediately):** Add PostgreSQL `tsvector` full-text search indexes and use `to_tsquery` / `plainto_tsquery` for search queries. PostgreSQL full-text search is built-in, requires no additional infrastructure, and supports ranked results:
```sql
ALTER TABLE "User" ADD COLUMN search_vector tsvector;
CREATE INDEX user_search_idx ON "User" USING GIN(search_vector);
UPDATE "User" SET search_vector = to_tsvector('english', coalesce(name,'') || ' ' || coalesce(bio,''));
```

All filtering should be pushed to the SQL `WHERE` clause. Cursor-based pagination replaces the over-fetch pattern.

**Phase 3 (Future):** Migrate to a dedicated search service (Elasticsearch, Typesense, or Meilisearch) when cross-entity ranked search is required.

---

## ARCH-005 — Polling-Based Real-Time (No WebSocket)

**Severity:** High  
**Effort:** XL (Extra Large — months)  
**Priority:** 4

### Current Behavior

The frontend polls two endpoints on a fixed interval:
- `GET /api/notifications/count` — polled every **30 seconds** by `useNotifications`
- `GET /api/messages/conversations/:id` — the messages page re-fetches the conversation on a **5-second** interval to simulate real-time message delivery

Every active browser tab for every logged-in user generates these requests continuously, regardless of whether any new data exists.

### Impact

At 1,000 concurrent users:
- Notification count: 1,000 users × 2 requests/minute = **2,000 DB reads/minute**
- Message polling: Assume 200 active conversations × 12 requests/minute = **2,400 DB reads/minute**

Total: ~4,400 DB reads/minute for zero-value polls (when no new data exists). At 10,000 concurrent users this scales to ~44,000 reads/minute from polling alone — a significant fraction of Supabase's connection and query budget. Latency for message delivery is up to 5 seconds, which degrades perceived quality significantly compared to chat platforms.

### Root Cause

WebSocket infrastructure was not implemented in the initial build. Polling is the simplest mechanism to add perceived real-time behavior to a stateless REST API without server-side push capability.

### Recommended Fix

Introduce WebSocket support using Socket.io on the main backend. Cloud Run supports WebSockets when the service is configured with HTTP/2 or session affinity. The migration path:

1. Add `socket.io` to the main backend; configure it alongside the Express app.
2. On connection, authenticate the socket using the same JWT middleware (`socket.use(authMiddleware)`).
3. Subscribe the socket to a user-specific room: `socket.join(`user:${userId}`)`.
4. In `NotificationHandler` and `MessagingService`, emit to the room instead of (or in addition to) writing to DB:
   ```typescript
   io.to(`user:${recipientId}`).emit('notification', notificationPayload);
   io.to(`user:${recipientId}`).emit('message', messagePayload);
   ```
5. Frontend `useNotifications` and `useMessages` hooks connect to the socket and update the TanStack Query cache on push events, replacing the polling interval.

As an interim step before full WebSocket implementation, replace the 5-second message poll with Long Polling (HTTP request held open for up to 30 seconds, returned when new data arrives) to reduce DB read pressure by ~83%.

---

## ARCH-006 — Partial Repository Pattern Coverage

**Severity:** Medium  
**Effort:** L (Large — weeks)  
**Priority:** 8

### Current Behavior

Four of the sixteen backend modules implement a repository layer that abstracts Prisma behind an interface:
- `users/UserRepository`
- `opportunities/OpportunityRepository`
- `applications/ApplicationRepository`
- `organizations/OrganizationRepository`

The remaining twelve modules import the Prisma client directly inside service files:
```typescript
// Typical pattern in messaging service (direct Prisma — no repository)
import { prisma } from '../../lib/prisma';

export class MessagingService {
  async sendMessage(conversationId: string, senderId: string, body: string) {
    const conversation = await prisma.conversation.findUnique({ ... });
    // business logic mixed with DB calls
    await prisma.message.create({ ... });
    await prisma.conversation.update({ ... });
  }
}
```

### Impact

- **Testability:** Service methods that import Prisma directly cannot be unit tested without a real database or complex mocking of the Prisma client. Only the four modules with repositories can have their service logic tested in isolation via repository interface mocking.
- **Coupling:** Business logic is coupled to Prisma's query API. If Prisma is upgraded (breaking changes) or replaced, all twelve modules require simultaneous changes.
- **Consistency:** New developers onboarding have two patterns to learn and must decide which to follow when adding new functionality — creating drift in either direction.

### Root Cause

The repository pattern was applied to the first four modules built (core business entities) and then not propagated to the remaining modules as development velocity was prioritised. No architectural decision record (ADR) mandated consistent application.

### Recommended Fix

Standardise on repository pattern across all modules. Create a `BaseRepository<T>` generic class that wraps common Prisma operations (findById, findMany, create, update, delete) and can be extended per entity. Migrate one module at a time, starting with `messaging` (highest complexity) and `notifications` (highest read frequency). Add an ESLint rule or architectural fitness function that prohibits direct `prisma.*` imports in files matching `*.service.ts`.

---

## ARCH-007 — No Caching Layer

**Severity:** Critical  
**Effort:** M (Medium — days to weeks)  
**Priority:** 1

### Current Behavior

There is no Redis, Memcached, or in-process cache in the application. Every read request — regardless of how frequently the same data is requested — hits PostgreSQL directly. This includes:

- `GET /api/notifications/count` — called every 30 seconds per active user (see ARCH-005)
- `GET /api/opportunities` — full opportunity list fetched on every page load (see ARCH-010)
- `GET /api/users/:id` — public profile fetched on every profile view
- `GET /api/posts/feed` — feed computed from followed users' posts on every load
- `GET /api/search/users` — sequential scan query on every keystroke in search input

### Impact

This is rated Critical because it is the single highest-leverage remediation: adding a cache layer directly reduces database load across all the other architectural flaws simultaneously while they are being fixed. Without caching:

- Supabase connection pool (limited on free/starter tier) saturates quickly under moderate load.
- DB CPU spikes on every peak traffic event (e.g., a viral post).
- The notification polling pattern (ARCH-005) generates thousands of identical `COUNT(*)` queries per minute that return the same result.
- The opportunity list (ARCH-010) is a read-heavy endpoint that returns data changing at most once per minute; every request re-runs the full query.

### Root Cause

No caching infrastructure was included in the initial architecture. The Supabase free tier includes no Redis equivalent. Adding a caching layer requires a separate managed service (Upstash Redis on GCP, or GCP Memorystore) and changes to service layer logic.

### Recommended Fix

Add Redis via **Upstash** (serverless, no idle cost, compatible with Cloud Run's ephemeral instances) or **GCP Memorystore** (lower latency, higher cost).

Apply caching in three layers:

**Layer 1 — HTTP response cache (immediate, no code change):**  
Add `Cache-Control: public, max-age=30` on the opportunity list endpoint. CDN (Cloud CDN or Cloudflare) caches the response for 30 seconds globally.

**Layer 2 — Application-level cache (Redis):**  
Wrap the notification count query with a Redis `GET/SET` with a 30-second TTL:
```typescript
const cacheKey = `notif:count:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return parseInt(cached);
const count = await prisma.notification.count({ where: { userId, read: false } });
await redis.set(cacheKey, count, 'EX', 30);
return count;
```
Invalidate on `notification.markRead` and `notification.create`.

**Layer 3 — Query result cache:**  
Cache opportunity list results (filtered by sport/type) with a 60-second TTL. Cache public user profiles with a 5-minute TTL. Use cache stampede protection (lock or early expiry).

---

## ARCH-008 — JSON Blobs for Role-Specific User Data

**Severity:** Medium  
**Effort:** XL (Extra Large — months)  
**Priority:** 9

### Current Behavior

The `User` model stores role-specific profile data in two untyped JSON columns:
```prisma
model User {
  id           String @id @default(uuid())
  email        String @unique
  role         String
  athlete_data Json?
  coach_data   Json?
  // ...
}
```

The contents of `athlete_data` and `coach_data` are defined only in TypeScript interfaces in the application code. PostgreSQL does not enforce any schema on these columns. Examples of what `athlete_data` might contain:
```json
{
  "sport": "cricket",
  "position": "batsman",
  "dateOfBirth": "2000-05-14",
  "height": 178,
  "weight": 72,
  "achievements": ["U19 State Champion 2019"],
  "stats": { "matches": 45, "runs": 1240, "average": 38.7 }
}
```

### Impact

- **No DB-level validation:** A malformed or missing `athlete_data` structure is invisible to PostgreSQL. An athlete with `athlete_data: null` or `athlete_data: { sport: 123 }` is stored without error.
- **No indexing:** You cannot create a B-tree index on `athlete_data->>'sport'` efficiently. GIN indexes on JSON are possible but require explicit definition and are not currently applied, making filtering by sport in the search module a sequential scan across the JSON column.
- **Schema drift:** As the application evolves, the structure of `athlete_data` can change in the TypeScript interface without a corresponding migration. Old records with the old structure coexist with new records, requiring defensive `?.` access throughout the codebase.
- **Query complexity:** Prisma's JSON query API (`{ path: ['sport'], string_contains: 'cricket' }`) is less expressive and less performant than a properly indexed relational column.

### Root Cause

Storing role-specific data as JSON on a shared User model is a common early-stage pattern to avoid premature normalisation when the schema is still evolving. The trade-off is acceptable at zero users; it becomes a maintenance burden as the schema stabilises and query complexity grows.

### Recommended Fix

Migrate to proper relational tables using a "User + Profile" polymorphic pattern or table-per-role:

```prisma
model AthleteProfile {
  id          String @id @default(uuid())
  user_id     String @unique
  sport       String
  position    String?
  date_of_birth DateTime?
  height_cm   Int?
  weight_kg   Int?
  user        User @relation(...)
}

model CoachProfile {
  id          String @id @default(uuid())
  user_id     String @unique
  speciality  String?
  user        User @relation(...)
}
```

This enables proper indexes, foreign key integrity, and typed Prisma queries. The migration requires a data migration script to extract JSON values into the new tables and is an XL effort due to the number of places in the codebase that read from `athlete_data`.

---

## ARCH-009 — Scoring Subsystem Data Isolation

**Severity:** Medium  
**Effort:** XL (Extra Large — months)  
**Priority:** 10

### Current Behavior

The scoring subsystem runs a completely separate PostgreSQL database with its own Prisma schema. Player identity in the scoring DB is represented only as a `String` field containing the main app's `User.id` value:

```prisma
// Scoring schema (approximate)
model PlayerScore {
  id        String @id
  player_id String  // contains User.id from main app — no FK enforced
  match_id  String
  runs      Int
  // ...
}
```

There is no live database link, no shared Prisma client, no API bridge, and no webhook/event system between the scoring backend and the main backend. The SSO JWT exchange (`/scoring-api/api/auth/sso`) handles identity for authentication only — it does not synchronise any data.

### Impact

- **No profile integration:** An athlete's public profile on the main app cannot display their match statistics from the scoring subsystem. A scout browsing an athlete's profile cannot see how the athlete performed in scored matches.
- **No data consistency guarantee:** If a User is deleted or banned in the main app, their `player_id` references in the scoring DB are not cleaned up. The scoring DB accumulates orphaned records.
- **Duplicate identity management:** User profile information (name, sport, organisation) that is relevant to displaying scorecard context must be duplicated in the scoring DB or fetched via cross-service HTTP calls at render time.
- **Operational complexity:** Two separate databases mean two separate backup schedules, two separate migration histories, and two separate monitoring setups.

### Root Cause

The scoring subsystem was built as a standalone project and integrated post-hoc via SSO. The separation was intentional to allow independent development, but no integration layer was designed for data sharing.

### Recommended Fix

Design an explicit integration layer. Two options:

**Option A — API Bridge (Lower effort):** The main backend exposes an internal endpoint (`GET /internal/users/:id/scoring-stats`) that the scoring backend can call. The main backend proxies or aggregates scoring data by calling the scoring backend's read-only endpoints. Both services communicate via authenticated internal HTTP calls using a shared service-to-service token.

**Option B — Shared Event Bus (Higher effort, recommended long-term):** Introduce a message broker (GCP Pub/Sub or RabbitMQ). The scoring backend publishes `match.completed` events with player stats. The main backend subscribes, aggregates, and stores summary stats on the `AthleteProfile` table (once ARCH-008 is addressed). This eliminates cross-service HTTP coupling.

Regardless of option, define a formal data ownership contract: main app owns identity, scoring app owns match data, integration layer is responsible for the bridge.

---

## ARCH-010 — Client-Side Opportunity Sort and Filter

**Severity:** High  
**Effort:** M (Medium — days)  
**Priority:** 6

### Current Behavior

The Opportunities page fetches all open opportunities from `GET /api/opportunities` and then sorts and filters them entirely in the browser using JavaScript:

```typescript
// Approximate current pattern in OpportunitiesPage or useOpportunities hook
const { data: opportunities } = useQuery({
  queryKey: queryKeys.opportunities.list({}),
  queryFn: () => opportunityService.getOpportunities(),
  // No filters passed to API — fetches everything
});

// Client-side filter + sort in the component
const filtered = opportunities
  ?.filter(o => selectedSport ? o.sport === selectedSport : true)
  ?.filter(o => selectedType ? o.type === selectedType : true)
  ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
```

The API endpoint returns the full dataset of open opportunities in a single response. No server-side pagination is applied.

### Impact

- **Bandwidth:** As the platform grows to 1,000 open opportunities, the initial API response payload grows proportionally. At 10,000 opportunities, the payload is large enough to cause noticeable load times on mobile connections.
- **Database:** The query fetches all rows matching `status = 'open'` without limit. PostgreSQL will scan the entire index for open opportunities. Without `LIMIT` and `OFFSET` (or cursor pagination), memory usage on the DB side scales with the number of open opportunities.
- **Perceived performance:** The user sees the full list only after the entire payload downloads. There is no progressive loading or skeleton pagination.
- **Filter accuracy:** A user filtering by sport only sees results from the batch that was fetched — if the batch is capped for other reasons (e.g., the API adds a hidden limit), the client-side filter may show fewer results than actually exist.

### Root Cause

Early-stage optimisation for development speed: client-side filtering requires no additional API parameters, no query builder logic, and no pagination UI. The trade-off is acceptable at dozens of opportunities; it breaks at hundreds.

### Recommended Fix

Move all filtering, sorting, and pagination to the server:

1. Update `GET /api/opportunities` to accept query parameters: `sport`, `type`, `sort` (`newest`, `deadline`), `cursor` (for cursor-based pagination), `limit`.
2. Apply filters in the Prisma query:
   ```typescript
   const opportunities = await prisma.opportunity.findMany({
     where: {
       status: 'open',
       ...(sport && { sport }),
       ...(type && { type }),
     },
     orderBy: sort === 'deadline'
       ? { application_deadline: 'asc' }
       : { created_at: 'desc' },
     take: limit + 1,  // +1 to detect next page
     cursor: cursor ? { id: cursor } : undefined,
   });
   ```
3. Return `{ data, nextCursor }` in the response.
4. Update the frontend hook to pass filters as query parameters and implement infinite scroll or "Load More" pagination using TanStack Query's `useInfiniteQuery`.

---

## Remediation Priority Order

The recommended order for addressing these flaws balances immediate risk reduction with dependency management (some fixes unlock or simplify others):

| Priority | ID       | Rationale                                                                  |
|----------|----------|----------------------------------------------------------------------------|
| 1        | ARCH-007 | Adding Redis cache reduces DB pressure across all other flaws simultaneously |
| 2        | ARCH-002 | Counter race condition causes data inaccuracy; fix is surgical and isolated |
| 3        | ARCH-004 | In-memory search fails at moderate scale; FTS indexes are additive          |
| 4        | ARCH-005 | WebSocket replaces polling; depends on Redis (Priority 1) for presence     |
| 5        | ARCH-001 | Documentation fix; zero risk, immediate value for onboarding               |
| 6        | ARCH-010 | Server-side pagination is self-contained; reduces bandwidth now             |
| 7        | ARCH-003 | Group messaging is a product feature; schema migration has low risk         |
| 8        | ARCH-006 | Repository standardisation; refactoring work, no user-visible change       |
| 9        | ARCH-008 | JSON-to-relational migration requires ARCH-006 done first; high effort     |
| 10       | ARCH-009 | Scoring integration is architectural; requires product decision on scope    |
