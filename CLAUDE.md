# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

---

## MASTER RULES — Read and Follow on Every Single Task

These rules apply to every task without exception. Never violate them.

### 1. Admin Override (CRITICAL)

Admin role bypasses ALL role restrictions everywhere in the codebase.

**Backend:**
- Never write `requireRole("x")` without including `"admin"`
- Never write `if (user.role !== "x")` without also checking `user.role !== "admin"`
- Always use the `ROLES` constants from `backend/src/utils/roles.ts`
- Pattern: `requireRole(...ROLES.ATHLETES_AND_ADMIN)` not `requireRole("athlete")`

**Frontend:**
- Never write `user.role === "x"` in JSX without using `hasRole()`
- Never write `["x","y"].includes(user.role)` — use `hasRole(user.role, "x", "y")`
- Always use helpers from `frontend/src/utils/roles.ts`
- `hasRole(userRole, ...roles)` returns true if userRole matches OR is "admin"
- `isAdmin(userRole)` returns true only for admin

**What stays admin-only (do NOT add other roles to these):**
- `/admin/*` routes
- `/verification/*` routes
- `/email-logs` routes
- `GET /admin/audit-log`

### 2. No Breaking Changes

Every task must leave the entire application fully functional.
If a fix risks breaking something else, fix both in the same task.
Never delete or rename a public API endpoint without updating every caller.

### 3. Build Must Pass After Every Task

Run both of these and fix every error before stopping:

```
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
```

Do not consider a task done until both pass with zero errors.

### 4. Mobile-First Responsive UI

- Every component must work at 375px width (iPhone SE) up to 1920px
- Use Tailwind responsive prefixes: base = mobile, `sm:` `md:` `lg:` for larger
- All touch targets: `min-h-[44px]` minimum
- No horizontal overflow on any page at 375px
- No hardcoded pixel widths on layout containers — use `w-full`, `max-w-*`, `flex`, `grid`
- Forms must not be hidden under mobile keyboard
- Safe area insets on iPhone: `pb-[env(safe-area-inset-bottom)]`

### 5. Architecture Rules — Never Skip a Layer

```
pages/ → hooks/ → services/ → api client
```

- Pages consume hooks only. Never call axios or useQuery directly in a page.
- Hooks wrap services in useQuery/useMutation and own cache invalidation.
- Services are typed methods over the axios instance.
- Always use `queryKeys.*` from `hooks/queryKeys.ts`. Never use raw string arrays.

### 6. Error Handling

- Frontend: always use `humanizeError(err)` from `api/client.ts`
- Backend: always throw using factory functions from `utils/errors.ts`
  (`BadRequest()`, `NotFound()`, `Forbidden()`, etc.)
- Never return error responses directly from route handlers

### 7. Schema Changes Require Migrations

Never change `database/prisma/schema.prisma` without creating a migration:

```
cd backend && npx prisma migrate dev --name describe_your_change
```

### 8. Role Helpers — Always Use These

**Backend** (`backend/src/utils/roles.ts`):

```typescript
export const ROLES = {
  ALL:                ["athlete","club","scout","organizer","scorer","admin"],
  CONTENT_CREATORS:   ["athlete","club","organizer","admin"],
  RECRUITERS:         ["club","scout","organizer","admin"],
  CLUB_MANAGERS:      ["club","organizer","admin"],
  SCORERS:            ["scorer","admin"],
  ATHLETES_AND_ADMIN: ["athlete","admin"],
} as const;
```

**Frontend** (`frontend/src/utils/roles.ts`):

```typescript
export function hasRole(userRole: string, ...roles: string[]): boolean {
  return roles.includes(userRole) || userRole === "admin";
}
export function isAdmin(userRole: string): boolean {
  return userRole === "admin";
}
```

### 9. Sport/Position Cascade

- Single source of truth: `frontend/src/data/sportPositions.ts`
- Backend mirror: `backend/src/utils/sportValidation.ts`
- When sport changes → position must clear immediately
- If sport is set, position is required — enforce in both Zod schema and UI
- Use `SportPositionSelect` component for all sport+position field pairs

### 11. Security-First Checklist — Read Before Writing Any Code

Full checklist lives in `SECURITY_RULES.md` at repo root. Before writing or
editing a single line of code, run it against that checklist — secrets,
rate limiting, input validation, auth/authz, SQL safety, CORS, security
headers, file upload safety, error handling, dependency security, XSS,
AI/LLM safety. That file also lists known unresolved gaps in this app
(refresh token in localStorage, scoring API CORS wildcard, disabled CSP,
in-process AI rate limiter, legacy upload endpoint) — do not reintroduce
these patterns elsewhere, and fix them opportunistically when touching
nearby code.

### 10. Demo Accounts for Testing

```
athlete@demo.sportivox  / Demo1234!
club@demo.sportivox     / Demo1234!
scout@demo.sportivox    / Demo1234!
admin@sportivox.local   / Demo1234!
admin@scoring.local     / Demo1234!  (scoring subsystem only)
```

---

## Execution Prompts — Run In Order

Run these in Claude Code (`claude` in terminal from repo root).
**Do not skip. Do not move to the next prompt until the build passes.**

---

### PROMPT 0 — Foundation (Run First — Everything Depends on This)

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES before doing anything.

TASK: Create the shared foundation used by every other module.

STEP 1 — backend/src/utils/roles.ts
Create this file exactly:

export const ROLES = {
  ALL:                ["athlete","club","scout","organizer","scorer","admin"],
  CONTENT_CREATORS:   ["athlete","club","organizer","admin"],
  RECRUITERS:         ["club","scout","organizer","admin"],
  CLUB_MANAGERS:      ["club","organizer","admin"],
  SCORERS:            ["scorer","admin"],
  ATHLETES_AND_ADMIN: ["athlete","admin"],
} as const;

STEP 2 — backend/src/utils/sportValidation.ts
Export: VALID_SPORTS (string[]), SPORT_POSITIONS (Record<string,string[]>),
isValidSportPosition(sport, position): boolean.

Sports and positions:
cricket: Right-hand Batsman, Left-hand Batsman, Right-arm Fast Bowler,
  Left-arm Fast Bowler, Right-arm Medium Bowler, Left-arm Medium Bowler,
  Right-arm Off Spinner, Left-arm Orthodox Spinner, Right-arm Leg Spinner,
  Left-arm Unorthodox Spinner, Wicket-keeper Batsman,
  Batting All-rounder, Bowling All-rounder
football: Goalkeeper, Centre-back, Right-back, Left-back,
  Defensive Midfielder, Central Midfielder, Attacking Midfielder,
  Right Winger, Left Winger, Centre Forward, Striker
basketball: Point Guard, Shooting Guard, Small Forward, Power Forward, Center
swimming: Freestyle, Backstroke, Breaststroke, Butterfly,
  Individual Medley, Open Water
athletics: 100m, 200m, 400m, 800m, 1500m, 5000m, 10000m, Marathon,
  110m Hurdles, 400m Hurdles, High Jump, Long Jump, Triple Jump,
  Pole Vault, Shot Put, Discus, Javelin, Hammer, Decathlon, Heptathlon
hockey: Goalkeeper, Defender, Right Midfielder, Left Midfielder,
  Centre Midfielder, Forward, Right Wing, Left Wing
tennis: Singles, Doubles, Mixed Doubles
badminton: Singles, Doubles, Mixed Doubles
volleyball: Setter, Outside Hitter, Opposite Hitter, Middle Blocker, Libero
kabaddi: Raider, Defender, All-rounder
wrestling: Freestyle, Greco-Roman
boxing: Flyweight, Bantamweight, Featherweight, Lightweight, Welterweight,
  Middleweight, Light Heavyweight, Heavyweight
other: Not Applicable

STEP 3 — frontend/src/utils/roles.ts
Create this file exactly:

export function hasRole(userRole: string, ...roles: string[]): boolean {
  return roles.includes(userRole) || userRole === "admin";
}
export function isAdmin(userRole: string): boolean {
  return userRole === "admin";
}

STEP 4 — frontend/src/data/sportPositions.ts
Mirror of backend sport/position data. Export:
SPORT_POSITIONS: Record<string, string[]> (same data as backend)
SPORTS_LIST: { value: string; label: string }[]
getPositions(sport: string | null | undefined): string[]
isValidPosition(sport: string, position: string): boolean

STEP 5 — frontend/src/components/SportPositionSelect.tsx
Props interface:
  sportValue: string
  positionValue: string
  onSportChange: (sport: string) => void
  onPositionChange: (position: string) => void
  sportError?: string
  positionError?: string
  disabled?: boolean
  required?: boolean
  layout?: "row" | "column"

Rules:
- When sportValue changes → call onPositionChange("") immediately
- Position select is disabled when sportValue is empty
- Position options re-render whenever sportValue changes
- Red border + error text below when error props are set
- Use existing design system classes from the project
- Mobile: always single column regardless of layout prop
- Touch targets: min-h-[44px] on both selects
- Sport placeholder: "Select sport" (value="")
- Position placeholder: "Select position" (disabled until sport chosen)
- Named export: SportPositionSelect

STEP 6 — frontend/src/components/ErrorBoundary.tsx
Class component with componentDidCatch.
Fallback UI matches design system.
Shows "Something went wrong" + "Try again" button (window.location.reload()).
Full width, readable at 375px.
Named export: ErrorBoundary

STEP 7 — frontend/src/components/MobileDrawer.tsx
Bottom-sheet drawer for mobile filters and forms.
Props: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }
Mobile (< lg): slides up from bottom, full width, max-h-[85vh],
  scrollable content, drag handle at top, backdrop closes on tap, CSS transition.
Desktop (lg+): renders children inline, no drawer.
Named export: MobileDrawer

STEP 8 — Refactor ALL requireRole() calls in backend/src/modules/
Find every requireRole() that does not include "admin". Replace with ROLES.*:
  requireRole("athlete")            → requireRole(...ROLES.ATHLETES_AND_ADMIN)
  requireRole("club","organizer")   → requireRole(...ROLES.CLUB_MANAGERS)
  requireRole("scorer")             → requireRole(...ROLES.SCORERS)
  requireRole("club","organizer","scorer") → requireRole(...ROLES.CLUB_MANAGERS, "scorer")
EXCEPTION: keep requireRole("admin") as-is on admin-only routes.

STEP 9 — Refactor ALL role checks in frontend/src/
Find every user.role === / !== and [].includes(user.role) in JSX.
Replace with hasRole() / isAdmin() from frontend/src/utils/roles.ts.
Examples:
  {user.role === "athlete" && <X />}
    → {hasRole(user.role, "athlete") && <X />}
  {["club","organizer"].includes(user.role) && <X />}
    → {hasRole(user.role, "club", "organizer") && <X />}
  {post.author_id === user.id && <DeleteButton />}
    → {(post.author_id === user.id || isAdmin(user.role)) && <DeleteButton />}

STEP 10 — Ownership checks in service files
Find every ownership check pattern in backend services:
  if (resource.owner_id !== user.id) throw Forbidden()
Replace with:
  if (resource.owner_id !== user.id && user.role !== "admin") throw Forbidden()

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error. Do not stop until both pass with zero errors.
```

---

### PROMPT 1 — Auth Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. Foundation from PROMPT 0 is complete.

TASK: Make the Auth module enterprise-grade, fully functional, mobile-responsive.

BACKEND — backend/src/modules/auth/

1. REGISTRATION SCHEMA (auth.schemas.ts):
   email: valid email, lowercase trimmed
   password: min 8 chars, regex /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/
   full_name: min 2 max 100 trimmed
   role: enum of valid roles only

2. BRUTE-FORCE PROTECTION:
   Create Prisma migration adding LoginAttempt table: { id, email, attempted_at }
   After 5 failed attempts for same email within 15 minutes → return 429
   On successful login: delete all LoginAttempt records for that email
   Always return "Invalid credentials" — never reveal which field is wrong

3. TOKEN ROTATION (auth.service.ts):
   Old token delete + new token create = ONE prisma.$transaction([...])
   Refresh token not found or expired → 401 "Session expired, please log in again"

4. PASSWORD RESET:
   Token expiry: enforce with WHERE expiresAt > NOW() in the DB query
   Single-use: DELETE token immediately before updating password (same transaction)
   Rate limit: max 3 reset emails per email address per hour

5. EMAIL VERIFICATION:
   Token expires in 24 hours
   Add POST /auth/resend-verification (rate limited 3/hour, requireAuth)

6. SAFE USER SELECT:
   In backend/src/utils/user.ts add:
   export const safeUserSelect = {
     id: true, email: true, role: true, full_name: true,
     avatar_url: true, is_verified: true, emailVerified: true, created_at: true
   }
   Use this in every auth response. Never return password_hash or tokens.

FRONTEND — Auth pages

7. LOGIN PAGE:
   Mobile: full-width form, no card
   Desktop: max-w-md centered card
   Fields: email, password (with show/hide toggle)
   All fields: min-h-[44px]
   Inline validation errors below each field (react-hook-form + Zod)
   "Forgot password?" link below password field
   Submit button: full width on mobile
   On 429: "Too many attempts. Please try again in a few minutes."
   On any error: humanizeError() to display message

8. SIGNUP PAGE:
   Fields: full_name, email, role selector, password, confirm password
   Role selector: large tap-friendly select, min-h-[44px]
   Password strength indicator: weak/medium/strong shown below password field
   Confirm password: validate on blur that it matches
   All fields validated inline before submit
   On success: "Check your email to verify your account."

9. FORGOT PASSWORD PAGE:
   Email field + submit button
   On success: "If that email exists, a reset link has been sent."
   Never confirm whether email exists.

10. RESET PASSWORD PAGE:
    New password + confirm password fields
    Same strength requirements as signup
    On expired token: redirect to /forgot-password with error message

11. AXIOS 401 INTERCEPTOR (frontend/src/api/client.ts):
    Implement request queue to prevent multiple concurrent refresh calls.
    If refresh already in progress: queue the retry.
    On refresh success: replay all queued requests with new token.
    On refresh failure: clear auth store, redirect to /login, reject all queued.
    This must handle the case where 3+ requests fail with 401 simultaneously.

MOBILE REQUIREMENTS:
- No horizontal scroll at 375px on any auth page
- Inputs do not hide under mobile keyboard
- All buttons min-h-[44px]

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
cd backend && npm test -- --testPathPattern="auth"
Fix every error.
```

---

### PROMPT 2 — User Profile Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the User Profile module enterprise-grade, fully functional,
mobile-responsive.

BACKEND — backend/src/modules/users/

1. PROFILE UPDATE SCHEMA (users.schemas.ts):
   full_name: min 2 max 100 trimmed
   bio: max 500
   location: max 100
   avatar_url: valid URL or empty string
   sport: must be in VALID_SPORTS from backend/src/utils/sportValidation.ts
   position: if sport provided, must pass isValidSportPosition(sport, position)
   superRefine: if sport present and position empty → add Zod error on position field

2. ATHLETE DATA SCHEMA (PUT /users/athlete-data):
   date_of_birth: valid date, must be 5-60 years ago
   height_cm: integer 100-250
   weight_kg: integer 30-200
   experience_years: integer 0-50
   achievements: string array, max 20 items, each max 200 chars
   availability: enum ["available","not_available","open_to_offers"]
   sport + position: same cascade validation as profile update

3. SAFE SELECT: use safeUserSelect from utils/user.ts on every GET /users/:id

4. FOLLOW COUNT — ATOMIC FIX (ARCH-002):
   In follow.service.ts replace increment pattern with atomic SQL:
   prisma.$transaction([
     prisma.follow.create({ data: { followerId, followingId } }),
     prisma.$executeRaw`UPDATE "User" SET follower_count = follower_count + 1
       WHERE id = ${followingId}`,
     prisma.$executeRaw`UPDATE "User" SET following_count = following_count + 1
       WHERE id = ${followerId}`
   ])
   Unfollow: same pattern with -1.

FRONTEND — Profile pages

5. PROFILE VIEW PAGE:
   Mobile:
   - Avatar: 96px centered
   - Name + role badge: centered
   - Follow button: full width, min-h-[44px]
   - Stats row (followers, following, sport): horizontal scroll if overflow
   - Bio: full width, wraps correctly
   - Tabs (Posts, Reels, About): horizontally scrollable tab bar
   - AI Tips: collapsible to save space
   Desktop:
   - Avatar 128px, left-aligned
   - Two-column layout for stats and bio

6. PROFILE EDIT FORM:
   Use SportPositionSelect for sport + position fields.
   Cascade rules:
   - New sport selected → position clears immediately, shows "Select position"
   - Submit with sport but no position → inline error on position field
   - If loaded profile has sport X + position Y, user changes sport to Z:
     position clears and is required before form can submit
   - Successful save: success toast, do NOT reset form (show saved values)
   - Failed save: show error, keep all field values intact
   Mobile:
   - Single column
   - All inputs full width
   - Save button: sticky bottom bar, full width
   - Avatar: tap to change (camera icon overlay, input[type=file] accept="image/*")
   Desktop:
   - Two-column grid (sm:grid-cols-2) for some fields

7. ATHLETE DATA FORM:
   date_of_birth: native date input
   height/weight: number inputs with unit labels (cm, kg)
   achievements: add/remove list — each item is an input, remove button right side
   availability: large radio buttons or segmented control, min-h-[44px] each

8. QUERY CACHE INVALIDATION:
   After profile update: invalidate queryKeys.users.detail(userId)
   After follow: invalidate queryKeys.users.detail(targetId)
     and queryKeys.users.detail(currentUserId)
   After unfollow: same invalidations

MOBILE REQUIREMENTS:
- No horizontal scroll at 375px except intentional tab bar
- Inputs never hidden under mobile keyboard
- All buttons min-h-[44px]

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 3 — Opportunities Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Opportunities module enterprise-grade, fully functional,
mobile-responsive. Fix ARCH-010 (client-side filtering → server-side).

BACKEND — backend/src/modules/opportunities/

1. SERVER-SIDE FILTERING + PAGINATION (ARCH-010 fix):
   GET /api/opportunities accepts:
     sport?: string (must be in VALID_SPORTS if provided)
     type?: string (trial|recruitment|scholarship|tournament|coaching)
     sort?: "newest" | "deadline" (default: newest)
     cursor?: string (last opportunity id)
     limit?: number (default 20, max 50)
   Prisma query:
     findMany({
       where: { status:"open", ...(sport&&{sport}), ...(type&&{type}) },
       orderBy: sort==="deadline" ? {application_deadline:"asc"} : {created_at:"desc"},
       take: limit + 1,
       cursor: cursor ? { id: cursor } : undefined
     })
   Return: { data: Opportunity[], nextCursor: string | null, total: number }

2. CREATE/UPDATE SCHEMA (opportunities.schemas.ts):
   title: min 5 max 200 trimmed
   description: min 20 max 5000
   sport: required, in VALID_SPORTS
   type: required, enum
   vacancies: integer 1-1000
   application_deadline: must be future date
     .refine(d => new Date(d) > new Date(), "Deadline must be in the future")
   location: max 200
   eligibility.age_min + age_max: if both present, min < max

3. BUSINESS RULES:
   Create: requireRole(...ROLES.CLUB_MANAGERS)
   Update/Delete: check org.owner_user_id === user.id || user.role === "admin"
     throw 403 if neither
   Cannot update a closed/filled opportunity → throw 422
   On delete: transition all pending/shortlisted applications to "withdrawn",
     emit application.status_changed for each, notify each athlete

4. DEADLINE AUTO-CLOSE:
   In server.ts add setInterval (every 5 minutes) calling
   checkAndCloseExpiredOpportunities() in opportunities.service.ts:
   UPDATE opportunities SET status='closed'
   WHERE status='open' AND application_deadline < NOW()
   Log count of closed opportunities each run.

FRONTEND

5. OPPORTUNITIES LIST PAGE:
   Replace all client-side filtering with server-side params.
   Use useInfiniteQuery with queryKeys.opportunities.list(filters).
   Desktop: filter sidebar left (240px), cards grid right (3 columns)
   Mobile:
   - Filter button at top → opens MobileDrawer with all filters
   - Single column card list
   - "Load More" button at bottom
   - Active filter count badge on filter button e.g. "Filters (2)"
   When filter changes: reset cursor, refetch from beginning.

6. OPPORTUNITY CARD:
   Desktop: horizontal card
   Mobile: stacked card, full width
   - Sport badge, type badge
   - "DEADLINE PASSED" red badge if deadline < now()
   - "X spots left" (vacancies - application_count)
   - Apply button: disabled with tooltip if deadline passed / already applied / full
   - hasRole(user.role, "club","organizer") shows manage actions
   - All action buttons min-h-[44px]

7. CREATE/EDIT FORM:
   Mobile: single column, full-width inputs, sticky submit bar at bottom
   Desktop: two-column grid for some fields
   - Deadline: date picker, min date = tomorrow
   - Vacancies: number input, min=1 max=1000
   - Description: textarea with character counter X/5000
   - All fields validated inline before submit
   After create: navigate to new opportunity detail page
   After update: invalidate queryKeys.opportunities.detail(id)
     and queryKeys.opportunities.list({})

8. OPPORTUNITY DETAIL PAGE:
   Mobile:
   - Full-width sections
   - Sticky "Apply Now" button at bottom of screen
   - Collapsible sections for Eligibility, Description, Organization
   Desktop:
   - Two-column layout (details left, apply sidebar right, sidebar sticky)

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 4 — Applications Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Applications module enterprise-grade, fully functional,
mobile-responsive.

BACKEND — backend/src/modules/applications/

1. APPLY VALIDATION — check in this exact order:
   a. Opportunity exists and status === "open" → else 400 "Opportunity is not open"
   b. application_deadline >= now() → else 400 "Application deadline has passed"
   c. No existing application by this athlete for this opp → else 409 "Already applied"
   d. application_count < vacancies → else 400 "This opportunity is full"
   Use prisma.$transaction with SELECT FOR UPDATE on opportunity row
   to prevent race conditions on checks c and d.

2. STATE MACHINE — enforce ALL transitions:
   Valid transitions only:
     pending → shortlisted (club/organizer/admin)
     pending → rejected (club/organizer/admin)
     pending → withdrawn (athlete/admin)
     shortlisted → selected (club/organizer/admin)
     shortlisted → rejected (club/organizer/admin)
     shortlisted → withdrawn (athlete/admin)
   Any other transition → throw 422 "Invalid status transition"
   withdrawn, rejected, selected are terminal → throw 422 if re-transition attempted

3. VACANCY MANAGEMENT:
   On → selected:
   prisma.$transaction([
     update application status,
     prisma.$executeRaw`UPDATE "Opportunity"
       SET filled_count = filled_count + 1 WHERE id = ${oppId}`,
     check and set status="filled" if filled_count >= vacancies
   ])
   On → withdrawn/rejected from shortlisted:
     If opportunity was "filled", set back to "open"

4. EVENTS:
   Every status transition emits application.status_changed via EventBus.
   Payload: { applicationId, opportunityTitle, athleteId, clubId,
              fromStatus, toStatus, actorId }
   NotificationHandler creates in-app notification AND triggers email.

5. OWNERSHIP:
   Shortlist/select/reject: verify opp.org.owner_user_id === user.id
     || user.role === "admin" → throw 403 if neither
   Withdraw: verify application.applicant_user_id === user.id
     || user.role === "admin"

FRONTEND

6. ATHLETE — MY APPLICATIONS PAGE:
   Mobile:
   - Status filter tabs: horizontally scrollable row at top
     (All | Pending | Shortlisted | Selected | Rejected | Withdrawn)
   - Each card: full width, stacked
     Shows: opportunity title, org name, sport, status badge, applied date
   - Withdraw button: only for pending/shortlisted, min-h-[44px]
   - Withdraw confirmation: MobileDrawer on mobile, modal on desktop
   - Empty state per tab: friendly message + CTA to browse opportunities
   Desktop:
   - Same tabs, 2-column card grid

7. CLUB — APPLICATIONS PIPELINE:
   Desktop: Kanban board with columns per status
   Mobile: tab-based list view (same status tabs)
   Each card: athlete name, sport, position, applied date
   Action buttons per card status:
     pending: "Shortlist" (green) + "Reject" (red)
     shortlisted: "Select" (brand) + "Reject" (red)
   All action buttons min-h-[44px], confirmation dialog before reject/select
   hasRole(user.role, "club","organizer") controls visibility
   After action: optimistic update immediately, invalidate on settle

8. APPLY BUTTON STATES on Opportunity detail:
   "Apply Now" — enabled (athlete/admin only, hasRole(user.role, "athlete"))
   "Applied ✓" — disabled, shows current status (if already applied)
   "Applications Closed" — disabled (deadline passed)
   "No Vacancies" — disabled (opportunity full)
   All states: min-h-[44px]

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
cd backend && npm test -- --testPathPattern="applications"
Fix every error.
```

---

### PROMPT 5 — Feed & Posts Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Feed/Posts/Comments module enterprise-grade, fully functional,
mobile-responsive. Add server-side pagination.

BACKEND — backend/src/modules/posts/

1. FEED PAGINATION:
   GET /api/posts/feed accepts: cursor?, limit (default 20)
   Returns: { data: Post[], nextCursor: string | null }
   Only posts from followed users + own posts, ordered by created_at DESC.

2. POST SCHEMA:
   content: min 1 max 2000 chars trimmed
   media_url: optional valid URL

3. LIKE — ATOMIC FIX (ARCH-002):
   prisma.$transaction([
     prisma.$executeRaw`INSERT INTO "PostLike" (post_id, user_id)
       VALUES (${postId}, ${userId}) ON CONFLICT DO NOTHING`,
     prisma.$executeRaw`UPDATE "Post"
       SET like_count = (SELECT COUNT(*) FROM "PostLike" WHERE post_id = ${postId})
       WHERE id = ${postId}`
   ])
   Unlike: DELETE then recount. Return { like_count, liked: boolean }.

4. DELETE POST ownership:
   if (post.author_id !== user.id && user.role !== "admin") throw Forbidden()

5. COMMENTS (paginated):
   GET /api/posts/:id/comments — cursor, limit 20
   POST /api/posts/:id/comments — content min 1 max 1000
   DELETE — author or admin only
   Delete ownership: if (comment.author_id !== user.id && user.role !== "admin")

FRONTEND

6. FEED PAGE:
   Mobile:
   - Single column, full-width cards
   - Create post: collapsed by default, tap "Share an update" to expand
   - Infinite scroll (useInfiniteQuery)
   - Pull-to-refresh (detect pull gesture, call refetch())
   Desktop:
   - Center column max-w-2xl
   - Create post form always visible at top

7. POST CARD:
   Mobile:
   - Avatar 40px + name + time: horizontal row
   - Content: full width, "Read more" at 3 lines with expand toggle
   - Media: full width, max-h-80, object-cover
   - Like / Comment / Share row: evenly spaced, min-h-[44px] each
   OPTIMISTIC LIKE:
   onMutate: toggle liked state and ±1 like_count in cache immediately
   onError: roll back to previous cache state
   onSettled: invalidate to ensure accuracy

8. CREATE POST FORM:
   Mobile: MobileDrawer with textarea and media upload
   Desktop: card at top of feed
   - Textarea: auto-grows, min 3 rows
   - Media: tap to add image, preview before posting
   - Character counter X/2000, red when > 1800
   - Submit: disabled if content empty

9. COMMENTS:
   Mobile: inline below card, max 3 shown, "View all X comments" opens MobileDrawer
   Desktop: inline expand
   Add comment: sticky input at bottom of comment sheet on mobile
   Delete: own comments or isAdmin(user.role)
   All tap targets min-h-[44px]

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 6 — Reels Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Reels module enterprise-grade, fully functional, mobile-responsive.

BACKEND — backend/src/modules/reels/

1. ROLE: POST /reels → requireRole(...ROLES.ATHLETES_AND_ADMIN)
   (admin can upload reels — this is the fix from the admin override rule)

2. SCHEMA: title min 1 max 100, description max 500, video_url required valid URL

3. FEED: paginated (cursor, limit 10)

4. LIKE — ATOMIC FIX (ARCH-002): same pattern as posts module.

5. VIEW COUNT: atomic increment on GET /reels/:id
   prisma.$executeRaw`UPDATE "Reel" SET view_count = view_count + 1 WHERE id = ${id}`

6. DELETE ownership:
   if (reel.author_id !== user.id && user.role !== "admin") throw Forbidden()

FRONTEND

7. REELS FEED PAGE:
   Mobile: full-screen vertical scroll, each reel 100vh
   - Snap scroll (CSS scroll-snap-type: y mandatory)
   - Like button: right side overlay, 56px, shows count, min-h-[44px]
   - Comment button: right side, opens MobileDrawer
   - Author info: bottom overlay
   Desktop: 3-column grid, click opens full-screen player modal

8. VIDEO PLAYER:
   HTML5 video, controls on desktop, tap-to-play on mobile
   Autoplay muted when scrolled into view (IntersectionObserver)
   Pause when scrolled out. loop: true.

9. REEL UPLOAD:
   Upload button visible to: hasRole(user.role, "athlete")
   Mobile: "+" button → MobileDrawer with:
   - Video picker (input[type=file] accept="video/*" capture="camcorder")
   - Title input (required, min-h-[44px])
   - Description textarea (optional)
   - Upload progress bar (essential for large files)
   Uses two-step GCS flow: POST /media/upload-url → PUT signedUrl
     → POST /media/confirm → POST /reels
   Desktop: same flow in a modal

10. DELETE button: visible to author or isAdmin(user.role)

11. COMMENTS: MobileDrawer on mobile, inline on desktop. Same pattern as posts.

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 7 — Blogs Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Blogs module enterprise-grade, fully functional, mobile-responsive.

BACKEND — backend/src/modules/blogs/

1. SCHEMA: title min 5 max 200, content min 100 max 50000,
   tags: string array max 10 items each max 30 chars,
   cover_image_url: optional valid URL, status: enum ["draft","published"]

2. VISIBILITY: only published blogs in public list.
   Author sees own drafts. Admin sees all.

3. PAGINATION: cursor-based, limit 20.

4. LIKE — ATOMIC FIX (ARCH-002): same pattern as posts.

5. VIEW COUNT: atomic increment on read.

6. SLUG: auto-generate from title on create, ensure unique (append -2, -3 if needed).

7. DELETE ownership:
   if (blog.author_id !== user.id && user.role !== "admin") throw Forbidden()

8. UPDATE ownership:
   if (blog.author_id !== user.id && user.role !== "admin") throw Forbidden()

FRONTEND

9. BLOGS LIST PAGE:
   Mobile: single column cards
   Desktop: 2-3 column grid
   - Filter by tag: horizontal scrollable tag chips
   - Search: debounced 300ms input

10. BLOG CARD:
    Mobile: cover image full-width 16:9 (if present), then title + excerpt + tags
    Desktop: cover image left, content right
    - Read time: Math.ceil(wordCount / 200) + " min read"
    - Author avatar + name + date

11. BLOG READER PAGE:
    Mobile:
    - Full-width content, text-base leading-relaxed (min 16px)
    - Table of contents: collapsible at top
    - Like button: fixed bottom-right (56px circle)
    - Comments: below article, collapsible
    Desktop: max-w-3xl centered, sticky TOC sidebar on wide screens

12. BLOG EDITOR:
    Mobile: full-screen, single column
    - Title: large input at top
    - Content: auto-growing textarea
    - Tags: chip input (type + Enter to add, tap × to remove)
    - Cover image: GCS upload flow with preview
    - Draft/Publish: clear segmented control
    - Save Draft / Publish: two distinct buttons, sticky bottom bar on mobile
    - Character counter X/50000

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 8 — Search Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Search enterprise-grade. Fix ARCH-004 (in-memory → PostgreSQL FTS).

BACKEND — backend/src/modules/search/

1. MIGRATION (add_fts_indexes):
   ALTER TABLE "User" ADD COLUMN IF NOT EXISTS search_vector tsvector;
   CREATE INDEX CONCURRENTLY IF NOT EXISTS user_fts_idx
     ON "User" USING GIN(search_vector);

   ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS search_vector tsvector;
   CREATE INDEX CONCURRENTLY IF NOT EXISTS org_fts_idx
     ON "Organization" USING GIN(search_vector);

   ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS search_vector tsvector;
   CREATE INDEX CONCURRENTLY IF NOT EXISTS opp_fts_idx
     ON "Opportunity" USING GIN(search_vector);

   Add DB triggers to auto-update search_vector on insert/update:
   User: to_tsvector('english', coalesce(full_name,'') || ' '
     || coalesce(bio,'') || ' ' || coalesce(location,''))
   Organization: to_tsvector('english', coalesce(org_name,'')
     || ' ' || coalesce(description,''))
   Opportunity: to_tsvector('english', coalesce(title,'')
     || ' ' || coalesce(description,''))

2. SEARCH SERVICE (search.service.ts):
   Replace ALL LIKE queries and in-memory filtering with prisma.$queryRaw
   using plainto_tsquery('english', query).
   Push ALL filters into SQL WHERE clause.
   Remove the 3x over-fetch pattern entirely.
   Add cursor pagination to all three search endpoints.
   Each endpoint accepts: q (required), sport?, sort?, cursor?, limit?
   Returns: { data, nextCursor, total }

FRONTEND

3. SEARCH PAGE:
   Mobile:
   - Sticky search input at top, full width, min-h-[44px]
   - Tab bar: Players | Clubs | Opportunities
   - Filter button → MobileDrawer with sport, role, location
   - Single column results
   - Infinite scroll per tab
   - Empty state with suggestions
   Desktop:
   - Filter sidebar left, results right
   - 2-3 column grid for results

4. SEARCH BAR (in Layout header):
   Mobile: collapsed to search icon, tap to expand full-width input with X to close
   Desktop: visible in header (existing behaviour)
   Both: Cmd+K (desktop) / tap icon (mobile) focus the input

5. SEARCH RESULT CARDS:
   Player: avatar, name, sport + position, location, follow button
   Club: logo, name, sport categories, verification badge
   Opportunity: title, sport, type, deadline, vacancies
   All cards: full-width on mobile, min-h-[72px], tap anywhere to navigate

6. DEBOUNCE: 300ms before firing API call.
   Skeleton cards while loading.
   "No results for X" empty state with clear button.

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
cd backend && npx prisma migrate dev --name add_fts_indexes
Fix every error.
```

---

### PROMPT 9 — Messaging Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Messaging enterprise-grade, fully functional, mobile-responsive.
Replace 5-second polling with long-polling (interim fix for ARCH-005).

BACKEND — backend/src/modules/messaging/

1. AUTHORIZATION:
   Every endpoint: verify req.user.id is in conversation.participant_ids
   Throw 403 if not. Check in service, not just middleware.

2. LONG POLLING:
   Add GET /api/messages/conversations/:id/poll?after=<messageId>
   Hold open up to 25 seconds.
   Return immediately if new messages exist after given messageId.
   Return 204 after 25s if nothing new.
   Use Map<conversationId, Set<response>> to track waiting clients.
   On new message: resolve all waiting pollers for that conversation.

3. UNREAD COUNTS:
   Create migration: UnreadCount table { conversationId, userId, count }
   Replace JSON unread_counts on Conversation with this table.
   Atomic increment: prisma.$executeRaw`INSERT INTO "UnreadCount"
     (conversation_id, user_id, count) VALUES (${cId}, ${uId}, 1)
     ON CONFLICT (conversation_id, user_id)
     DO UPDATE SET count = "UnreadCount".count + 1`
   Mark read: UPDATE UnreadCount SET count = 0
     WHERE conversation_id = ${cId} AND user_id = ${uId}

4. MESSAGE SCHEMA:
   body: min 1 max 5000 trimmed
   Cannot send to yourself → 400

FRONTEND

5. CONVERSATIONS LIST:
   Mobile: full-screen list
   Desktop: left panel 320px + right panel for active thread
   Each item: avatar, participant name, last message preview (60 chars),
     unread badge, relative timestamp
   Min-h-[64px], full-width tap target on mobile

6. MESSAGE THREAD:
   Mobile: full-screen, header with back button + participant name
   Desktop: right panel
   - Messages: flex-col-reverse, newest at bottom
   - Own messages: right-aligned, brand color bubble
   - Their messages: left-aligned, fill color bubble
   - Date separators between different days
   Input area (sticky bottom):
   - Full-width textarea (grows up to 3 lines)
   - Send button right, min-h-[44px]
   - Mobile: pb-[env(safe-area-inset-bottom)]

7. LONG POLL INTEGRATION:
   Replace 5-second setInterval in useMessages with:
   After receiving messages → immediately start long poll request.
   On response with new messages: append to cache, start next poll.
   On 204: start next poll after 1s delay.
   On unmount: cancel pending request (AbortController).

8. NEW CONVERSATION:
   "New Message" button → contact picker
   Mobile: full-screen user search
   Desktop: modal with search
   On select: POST /messages/conversations → navigate to new thread

MOBILE REQUIREMENTS:
- Input bar stays above keyboard at all times
- pb-[env(safe-area-inset-bottom)] on bottom navigation
- Smooth transition from conversation list to thread (no page reload feel)

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 10 — Notifications Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Notifications enterprise-grade, fully functional, mobile-responsive.

BACKEND — backend/src/modules/notifications/

1. NOTIFICATION TYPES — ensure handlers cover ALL events:
   application.submitted      → notify club: "New application from [athlete]"
   application.status_changed → notify athlete: "Your application was [status]"
   user.followed              → notify followee: "[user] started following you"
   post.liked                 → notify author: "[user] liked your post"
   message.sent               → notify recipient: "New message from [user]"
   org.verified               → notify owner: "Your organization has been verified"
   Each notification: { userId, actorId, type, title, body, link, read: false }
   link: deep link to relevant page e.g. "/applications/123"

2. PAGINATION: GET /api/notifications returns cursor-paginated results, limit 20.

3. MARK READ:
   PATCH /notifications/:id/read → set read=true
   PATCH /notifications/read-all → set all read=true for req.user.id
   Both: invalidate unread count cache after updating.

4. CLEANUP: setInterval in server.ts (daily) deletes notifications older than 90 days.

FRONTEND

5. NOTIFICATION BELL (Layout header):
   Unread badge: shows count, max displays "99+"
   Mobile: tap → navigate to /notifications full page
   Desktop: tap → dropdown panel (max-h-96 overflow-y-auto)

6. NOTIFICATIONS PAGE / PANEL:
   Mobile: full screen, back button, "Mark all read" in header
   Grouped by: Today | Yesterday | This Week | Earlier
   Each item:
   - Actor avatar 40px
   - Title bold + body text
   - Relative timestamp ("2m ago")
   - Unread: left border accent
   - Tap anywhere → navigate to notification.link AND mark as read
   - Min-h-[64px]
   Infinite scroll, load more on scroll

7. UNREAD COUNT OPTIMISATION:
   Store last known count in Zustand.
   Only trigger badge re-render if count actually changed.
   Prevents unnecessary re-renders on every 30s poll.

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 11 — Organizations & Verification Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Organizations and Verification enterprise-grade, fully functional,
mobile-responsive.

BACKEND

1. ORG CREATE SCHEMA:
   org_name: min 2 max 200 trimmed
   org_type: enum ["club","academy","school","university","association"]
   sport_categories: array, each in VALID_SPORTS, min 1 max 5
   description: max 2000
   location: max 200
   website: optional valid URL

2. CREATE: requireRole(...ROLES.CLUB_MANAGERS)

3. OWNERSHIP on update/delete:
   if (org.owner_user_id !== user.id && user.role !== "admin") throw 403

4. DOCUMENT UPLOAD (POST /organizations/:id/documents):
   Create migration: OrgDocument { id, orgId, key, name, uploadedAt }
   Generate GCS signed URL for private docs bucket.
   Record in OrgDocument table after upload confirmed.

5. VERIFICATION WORKFLOW:
   PATCH /verification/:orgId/approve:
   - Set org.is_verified = true
   - Emit org.verified event
   - AuditLog entry: { action:"org_verified", actorId, targetId:orgId }
   PATCH /verification/:orgId/reject:
   - Body: { reason: string } min 10 chars required
   - Emit org.verification_rejected event
   - Notify org owner with rejection reason
   - AuditLog entry

FRONTEND

6. ORG LIST PAGE:
   Mobile: single column full-width cards
   Desktop: 2-3 column grid
   - Verification badge on verified orgs
   - Sport chips: horizontally scrollable
   - Search + filter by sport and type

7. ORG DETAIL PAGE:
   Mobile: single column
   - Full-width hero/logo
   - Sport chips: horizontally scrollable
   - Description: "Read more" expand
   - Active opportunities: card list
   - Contact/Website: full-width button on mobile
   Desktop: two-column (org info left, active opps right)

8. ORG CREATE/EDIT FORM:
   Sport categories: multi-select chips (tap to add/remove)
   Document upload: file picker (PDF/images), shows uploaded files list
   Submit: sticky bottom bar on mobile

9. MY ORGANIZATIONS PAGE (club/organizer/admin):
   Mobile: full-width list
   - Each org: name, verification status, active opp count
   - "Post Opportunity" quick action per org
   - "Create Organization" FAB (bottom-right, 56px, min-h-[56px])

10. VERIFICATION QUEUE (admin only):
    Mobile: list with approve/reject buttons
    Desktop: table
    Each org: name, type, sport, submitted date, documents list
    Documents: tap to view (signed URL in new tab)
    Approve: confirmation dialog
    Reject: requires reason input in dialog (min 10 chars)

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 12 — Admin Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make the Admin module enterprise-grade, fully functional, mobile-responsive.

BACKEND — backend/src/modules/admin/

1. All /admin/* routes: verify requireRole("admin") on every single route.

2. USER MANAGEMENT:
   GET /admin/users: paginated (cursor, limit 20), filter by role, banned status,
     search by name/email
   PATCH /admin/users/:id/ban:
   - Body: { reason: string } required
   - Set user.is_banned=true, banned_reason, banned_at=now()
   - DELETE all RefreshToken records for that user (force logout)
   - AuditLog entry
   PATCH /admin/users/:id/unban:
   - Set user.is_banned=false
   - AuditLog entry

3. CONTENT MODERATION:
   DELETE /admin/posts/:id: hard delete post + all likes + comments + AuditLog
   DELETE /admin/reels/:id: hard delete + delete GCS file + AuditLog

4. REPORTS:
   GET /admin/reports: filter by status (open/resolved) and type (post/user/reel)
   PATCH /admin/reports/:id/resolve:
     Body: { action: "warned"|"banned"|"dismissed" }

5. AUDIT LOG:
   GET /admin/audit-log: paginated, filter by actorId, action, date range
   Never expose to non-admin roles.

FRONTEND

6. ADMIN DASHBOARD:
   Mobile: stacked stat cards + quick action buttons
   Desktop: 4-column stat grid + recent activity feed
   Stats: total users, new today, pending verifications, open reports

7. USER MANAGEMENT:
   Mobile: card list (not table)
   Desktop: sortable table with pagination
   Each entry: avatar, name, email, role badge, status (active/banned)
   Actions: View Profile, Ban (with reason input in MobileDrawer/modal), Unban
   Search: debounced name/email
   Role filter: tabs or dropdown

8. CONTENT MODERATION:
   Mobile: list of flagged content with preview + action buttons
   Each: content preview, reporter info, reason, timestamp
   "Remove Content" (red) + "Dismiss Report" (gray)
   Both require confirmation before action

9. AUDIT LOG:
   Mobile: chronological list, most recent first
   Each entry: actor name, action, target, timestamp
   Date range filter: two date inputs (native mobile date picker)
   "Download CSV" button: generate CSV client-side from fetched data

10. ADMIN NAVIGATION:
    Admin sees ALL nav items (every feature every role can access, plus admin panel)
    Pending verification count badge on admin sidebar link

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 13 — Media Upload Module

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Media Upload robust, enterprise-grade, mobile-responsive.

BACKEND — backend/src/modules/media/

1. UPLOAD URL SCHEMA (media.schemas.ts):
   fileName: max 255 chars, sanitize (reject if contains / \ .. )
   contentType: must be in allowlist:
     images: image/jpeg, image/png, image/webp, image/gif
     videos: video/mp4, video/webm, video/quicktime
     docs: application/pdf
   context: enum ["avatar","post","reel","blog-cover","org-logo","org-doc"]
   Max sizes by context (enforce via signed URL conditions):
     avatar: 5MB, post/blog-cover/org-logo: 10MB, reel: 200MB, org-doc: 20MB

2. SIGNED URL:
   Generate with content-type condition so client cannot upload wrong type.
   TTL: 15 minutes.
   Confirm endpoint: verify file exists in GCS before recording URL.

3. PRIVATE DOCS:
   GET /media/download-url/:key:
   Only org owner or admin can get signed download URL.
   TTL: 15 minutes.

FRONTEND

4. frontend/src/hooks/useUpload.ts:
   Props: { context, accept, maxSizeMB, onSuccess }
   Returns: { upload(file), progress, isUploading, error, reset }
   Flow:
   a. Validate file type + size client-side first (show error if invalid)
   b. POST /media/upload-url → signedUrl + key
   c. PUT signedUrl with XMLHttpRequest to track progress
      xhr.upload.addEventListener("progress", e => setProgress(e.loaded/e.total*100))
   d. POST /media/confirm { key, context }
   e. Call onSuccess(mediaUrl)
   Show specific error at each step. Allow retry without re-selecting file.

5. frontend/src/components/ImageUpload.tsx:
   Props: { value, onChange, context, label, aspectRatio? }
   States:
   - Empty: dashed border, camera icon, "Tap to upload"
   - Uploading: progress bar overlay on preview
   - Complete: image preview with "Change" overlay on hover/tap
   - Error: error message + retry button
   Mobile:
   - Full width, min-h-[120px] tap target
   - accept="image/*" capture="environment"
   - Correct aspect ratio preview (no stretching)

6. frontend/src/components/VideoUpload.tsx:
   Similar to ImageUpload for videos.
   Shows video thumbnail preview (URL.createObjectURL).
   Progress bar during upload (essential for large files).
   Shows file size + estimated time.

7. File size validation (client-side before upload):
   "Video must be under 200MB. Your file is 340MB."
   Check before calling upload-url endpoint.

MOBILE REQUIREMENTS:
- accept + capture attributes correct for mobile camera access
- Progress always visible during upload
- Large file uploads: UI stays responsive, no blocking
- On network drop during upload: show retry button, keep file selection

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Fix every error.
```

---

### PROMPT 14 — Dashboard, Navigation & Mobile Shell

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete.

TASK: Make Dashboard, Layout shell, and overall navigation enterprise-grade
and fully mobile-responsive.

LAYOUT SHELL (frontend/src/components/Layout.tsx)

1. MOBILE BOTTOM NAVIGATION (replaces sidebar on mobile):
   Add fixed bottom nav bar on < lg screens.
   Height: 56px + safe-area-inset-bottom.
   Background: bg-paper border-t border-hair.
   5 links per role:
     athlete:   Home, Opportunities, Feed, Messages, Profile
     club:      Home, Post Opp, Applications, Messages, Profile
     scout:     Home, Search, Feed, Messages, Profile
     organizer: Home, Post Opp, Tournaments, Messages, Profile
     admin:     Home, Users, Reports, Verifications, Profile
   Each item: icon + 10px label, centered, min-w-[44px].
   Active: brand color icon + text.
   Classes: fixed bottom-0 left-0 right-0 z-50
   pb-[env(safe-area-inset-bottom)]

2. Main content area on mobile:
   pb-[calc(56px+env(safe-area-inset-bottom))] to avoid bottom nav overlap.

3. MOBILE HEADER (< lg):
   Logo left (100px wide), Bell icon with badge center-right, Search icon right.
   Height: 56px. No sidebar toggle (bottom nav replaces it).

4. DESKTOP: sidebar unchanged from current implementation.

5. Remove touch swipe gesture to open/close sidebar (bottom nav replaces it).

DASHBOARD PAGES

6. ATHLETE DASHBOARD:
   Mobile (single column):
   - Welcome card + verification status badge
   - Profile completion card: progress bar + CTA if avatar/sport/position/bio missing
   - Quick stats row: followers, applications, profile views (horizontal scroll)
   - "Find Trials" button: full-width brand color, min-h-[44px]
   - Recent applications: 3 cards + "View all" link
   - AI Tips: collapsible, shows 1 tip + "Get more tips" button
   Desktop: 2-3 column grid

7. CLUB DASHBOARD:
   Mobile (single column):
   - Active opportunities count + "Post New" full-width button
   - Applications needing review: count + "Review Now" CTA
   - Recent activity: 5 most recent applications across all opps
   - Quick stats: total applications, shortlisted, selected
   Desktop: grid layout

8. SCOUT DASHBOARD:
   Mobile:
   - Search bar prominent at top, full-width
   - Saved athletes: horizontal scroll card strip
   - Recent searches: chip list
   - "Discover Athletes" CTA

9. ADMIN DASHBOARD:
   Mobile: large number stat cards stacked
   - Pending verifications count with "Review" CTA
   - Open reports count with "Review" CTA
   - Quick links to each admin section

GENERAL MOBILE AUDIT

10. Audit every page for horizontal overflow at 375px.
    Fix any: w-[Npx] where N > screen width, overflow-x-auto on wrong containers.

11. Touch targets audit:
    Every button, link, interactive element across all pages: min-h-[44px].
    Pay special attention to: table row actions, icon buttons, tag chips.

12. Typography:
    Body text minimum 14px (text-sm) everywhere.
    Never text-xs for body content. Error messages text-sm minimum.

13. Form inputs:
    Add noValidate to all form elements.
    Add inputMode="email" on email inputs, inputMode="numeric" on number inputs.
    date inputs: type="date" (native mobile picker).

VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
Open Chrome DevTools, set iPhone SE (375x667).
Verify every page: no horizontal scroll, all buttons 44px+.
Fix every error.
```

---

### PROMPT 15 — Performance, Caching & Final Hardening

```
You are working on the Sportzicon monorepo. Read CLAUDE.md and follow all
MASTER RULES. All previous prompts complete. This is the final pass.

TASK: Add caching (ARCH-007), fix remaining gaps, final mobile polish,
zero build errors.

REDIS CACHING (ARCH-007)

1. Add ioredis to backend/package.json.

2. Create backend/src/config/redis.ts:
   Reads REDIS_URL from env (optional field in env.ts Zod schema).
   If not set: log warning, all cache calls are no-ops (graceful degradation).
   Export: cacheGet(key), cacheSet(key, value, ttlSeconds), cacheDel(key).

3. Add REDIS_URL to backend/.env.example as optional.

4. Cache these endpoints:
   GET /notifications/count
     key: notif:count:{userId}, TTL: 30s
     Invalidate on: markRead, markAllRead, new notification created
   GET /opportunities (list)
     key: opps:list:{md5(queryParams)}, TTL: 60s
     Invalidate on: opportunity create/update/delete/close
   GET /users/:id (public profile)
     key: user:profile:{id}, TTL: 5min
     Invalidate on: profile update, follow/unfollow
   GET /organizations/:id
     key: org:{id}, TTL: 5min
     Invalidate on: org update, verification change

ERROR BOUNDARIES

5. Wrap with ErrorBoundary in App.tsx:
   - Entire Outlet in Layout.tsx
   - Entire Outlet in PublicLayout.tsx
   - Individual sections in: Feed (PostList separately from CreateForm),
     Opportunities (list separately from filters),
     Dashboard (each card section independently),
     Messages (ConversationList and MessageThread independently)

REMAINING ARCH FIXES

6. GIN INDEX on athlete_data JSON (short-term fix pending ARCH-008 migration):
   Migration: add_athlete_data_gin_index
   CREATE INDEX CONCURRENTLY IF NOT EXISTS athlete_data_gin
   ON "User" USING GIN (athlete_data jsonb_path_ops)
   WHERE athlete_data IS NOT NULL;

7. ASYNC HANDLER AUDIT:
   grep -r "router\.\(get\|post\|put\|patch\|delete\).*async" backend/src/modules/
   Every async route handler must be wrapped in asyncHandler().
   Missing asyncHandler = unhandled rejection bypasses global error handler.

8. QUERY KEY AUDIT:
   grep -r "useQuery\|useMutation\|invalidateQueries" frontend/src/
   Every call must use queryKeys.* not raw string arrays.
   Fix all violations.

9. TYPE SAFETY AUDIT:
   grep -r ": any" frontend/src/
   Replace every any in component props and hook return types with proper
   TypeScript types from models/*.model.ts.

FINAL MOBILE CHECKLIST
Run through every page at 375px in Chrome DevTools:
  No horizontal overflow
  All buttons min 44px height
  Text readable without pinch-zoom (min 14px)
  Forms not cut off by keyboard
  Images not overflowing container
  Bottom navigation visible and not overlapping content
  Safe area insets respected (iPhone notch/home bar)
  Loading states visible (skeletons or spinners)
  Error states visible and actionable
  Empty states have CTAs

Fix every issue found.

FINAL VERIFICATION:
cd frontend && npm run typecheck && npm run build
cd backend && npm run typecheck
cd backend && npm test
cd frontend && npm test
All must pass with zero errors and zero warnings.
Report what was fixed and confirm build output is clean.
```

---

## Original Commands Reference

### Full stack (preferred)

```
make dev          # docker compose up --build — starts everything
make test         # backend Jest + frontend Vitest
make build        # tsc (backend) + vite build (frontend)
make lint         # eslint both
make seed         # seed demo accounts into main DB
```

### Backend only (`cd backend`)

```
npm run dev       # tsx watch — hot-reload on :8080
npm run build     # tsc compile to dist/
npm test          # Jest, runs --runInBand --forceExit
npm run typecheck # tsc --noEmit only
npm run lint
```

### Run a single backend test file

```
cd backend && npm test -- --testPathPattern="auth"
cd backend && npm test -- --testPathPattern="opportunities" --verbose
```

> Backend integration tests require `DATABASE_URL` to contain `localhost` or `test`.
> They will refuse to run against the cloud Supabase URL — intentional safety guard
> in `tests/helpers/setup.ts`.

### Frontend only (`cd frontend`)

```
npm run dev       # Vite on :5173 with HMR
npm run build     # tsc --noEmit + vite build
npm test          # Vitest --run (single pass)
npm run test:watch
npm run typecheck # tsc --noEmit
```

### Scoring backend (`cd scoring/backend`)

```
npm run dev        # ts-node-dev hot-reload on :4000
npm run build      # tsc compile to dist/
npm run db:seed    # seed scoring demo admin account
npm run db:push    # push schema without migrations (dev only)
npm run db:migrate # prisma migrate dev
npm run db:studio  # Prisma Studio GUI
```

### Scoring frontend (`cd scoring/frontend`)

```
npm run dev        # Vite on :5174 (port is fixed in vite.config.ts)
npm run build
```

### Database (run from `backend/`)

```
npx prisma migrate dev --name describe_change  # create + apply migration
npx prisma migrate deploy                       # apply pending (production)
npx prisma studio                               # GUI browser
npx prisma generate                             # regenerate client after schema change
```

The main schema is at `database/prisma/schema.prisma` (not `backend/`).
Scoring schema: `scoring/backend/prisma/schema.prisma`.

### E2E tests (`cd e2e`)

```
(cd ../frontend && npm install) && (cd ../scoring/frontend && npm install)

npm test                    # all tests
npm run test:smoke
npm run test:critical
npm run test:auth
npm run test:scoring

npx playwright test tests/sportivox/landing.spec.ts
npx playwright test tests/scoring/live-scoring.spec.ts

npm run test:headed
npm run test:debug          # PWDEBUG=1
npm run test:ui             # Playwright UI mode
npm run report
```

---

## Architecture Reference

### Monorepo layout

```
backend/      Main Node.js + Express API (port 8080)
frontend/     React 18 + Vite SPA (port 5173 dev)
scoring/      Standalone cricket scoring service
  backend/      Node.js + Express (port 4000, own PostgreSQL)
  frontend/     React app (port 5174), auth via SSO with main app
database/     Single Prisma schema for the main backend
e2e/          Playwright suite covering both SPAs
infra/        Terraform for GCP Cloud Run deployment
```

### Backend module system

Every feature lives in `backend/src/modules/<name>/` with three files:
- `<name>.routes.ts` — Express Router, middleware, asyncHandler wrappers
- `<name>.service.ts` — business logic, repositories, EventBus emissions
- `<name>.schemas.ts` — Zod schemas

**16 modules:** auth, users, organizations, opportunities, applications,
posts, reels, blogs, follow, messaging, notifications, search, media, ai,
verification, admin, email-logs.

### Key backend infrastructure

**`lib/StateMachine.ts`** — Generic FSM used in `applications.service.ts`.
Never add transition logic directly into services — register listeners on
the machine in `workflows/`.

**`lib/EventBus.ts`** — Singleton fire-and-forget. Call
`eventBus.emit(EVENT, payload)` — do NOT await. Handlers in
`events/handlers/notificationHandler.ts`.

**`repositories/`** — Interface + Prisma pairs for Application, Opportunity,
Notification, User. Never import prisma directly in these four modules.

**`middleware/`** — Chain: `requireAuth` → `requireRole(...roles)` →
`validate(zodSchema)` → `asyncHandler(async fn)`. asyncHandler is mandatory.

### Frontend layer model

```
pages/    → hooks only (no useQuery/axios directly)
hooks/    → useQuery/useMutation + cache invalidation
services/ → typed axios methods
models/   → TypeScript interfaces only
```

This call direction is a contract, not a folder name — see the module layout
below for where these files physically live.

**`hooks/queryKeys.ts`** — ONLY allowed source of cache keys.

**`services/index.ts`** — DI wiring. Only file that imports `api`/`scoringApi`.

**`frontend/src/types.ts`** — Backward-compat shim only. New code imports
from `../models`.

### Frontend module layout

`frontend/src/` is organized feature-sliced: anything used by a single
feature lives in `frontend/src/modules/<feature>/{pages,hooks,services,components}/`,
mirroring the backend's `modules/<name>/` grouping. Anything used by 2+
features stays in the root dirs as a shared kernel — do not move it into a
module.

**Shared kernel (root dirs — stays here):**
- `components/{UI,BackButton,MobileDrawer,ErrorBoundary,Layout,PublicLayout,
  ProtectedRoute,SportPositionSelect}.tsx`
- `hooks/{index.ts,queryKeys.ts,useDebounce,usePublicStats,useUpload}.ts`
  (`hooks/index.ts` is a barrel re-exporting from each module's hooks)
- `services/index.ts` (barrel/DI wiring, re-exports from each module's services)
- `models/*` — kept centralized (pure types; not worth fragmenting)
- `store/*`, `api/*`, `data/*`, `utils/*`, `types.ts`

**Modules (`frontend/src/modules/<name>/`):** auth, landing, dashboard,
profile, opportunities, applications, tournaments, organizations, feed,
reels, blogs, comments, messaging, notifications, search, admin,
live-scoring (the last one covers both the spectator live-scores pages and
the scorer console pages — all views onto the `scoring/` subsystem's API).

New feature = new folder under `modules/`. Cross-module imports (e.g. the
`applications` module's hook importing the `opportunities` module's service)
are expected — the resource-owning module exposes its service, other modules
call it, same shape as backend modules calling each other's repositories.
Only route through the shared-kernel barrels (`hooks/index.ts`,
`services/index.ts`) for singletons that already have decorators applied;
import a sibling file within your own module directly.

### Zustand stores
- `store/auth.ts` — main session
- `store/scoringAuth.ts` — scoring JWT (named `scoringUser`, not `user`)
- `store/savedOpportunities.ts`
- `store/favorites.ts`

### Layouts
- `Layout` — authenticated shell (sidebar + nav)
- `PublicLayout` — unauthenticated shell
- `AdaptiveLayout` — picks correct layout based on `useAuthStore`

### Error handling
**Backend:** `BadRequest()`, `NotFound()`, `Forbidden()` from `utils/errors.ts`
**Frontend:** `humanizeError(err)` from `api/client.ts`
Response shape: `{ error: { code, message, details? } }` on every non-2xx.

### CI/CD

| Workflow | Trigger | Action |
|---|---|---|
| `ci.yml` | push/PR → main | Typecheck + build |
| `daily-e2e.yml` | daily 03:00 UTC | Playwright tests |
| `deploy-staging.yml` | push → main | Migrate + build + deploy |
| `deploy-production.yml` | git tag `v*` | Same → prod + GitHub Release |

### Adding a new API endpoint (checklist)

1. Add Zod schema to `modules/<name>/<name>.schemas.ts`
2. Add service function to `modules/<name>/<name>.service.ts`
3. Add route to `modules/<name>/<name>.routes.ts` using middleware chain
4. If notifying another user: `eventBus.emit(EVENT, payload)`
5. Add matching method to `services/<name>.service.ts`
6. Add/update hook in `hooks/use<Name>.ts` using `queryKeys.*`
7. Update `hooks/queryKeys.ts` if new cache key needed
