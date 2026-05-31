# Sportivox — Session Changelog
**Date:** 2026-05-31  
**Session type:** Bug fixes, UX improvements, code review

---

## 1. Authentication & Session

### Signup — Inline password validation
**Files:** `frontend/src/pages/Signup.tsx`
- Password requirements (8+ chars, uppercase, lowercase, digit) now validate on the Account step before advancing, instead of surfacing as a backend error on the next page
- Added real-time `PasswordRequirement` indicators below the password field (green tick / grey circle per rule)

### Signup — Stale draft after account creation
**Files:** `frontend/src/pages/Signup.tsx`
- Fixed: after successful signup, navigating back to `/signup` dropped the user on the "Verify your email" screen (step 3) instead of step 0
- Root cause: `save({ step: 3 })` was re-writing step 3 back to localStorage immediately after `clear()`. Removed that write — verification step is now in-memory only for the current session

### Logout — Stale query cache across accounts
**Files:** `frontend/src/components/Layout.tsx`, `frontend/src/api/client.ts`, `frontend/src/main.tsx`
- Fixed: logging out then signing in as a different user still showed the previous account's data (feed, profile, admin pages)
- Root cause: React Query cache was never cleared on logout
- Fix: `queryClient` exported from `main.tsx`; logout now calls `qc.clear()` in addition to clearing the auth store; the token-refresh failure path in `client.ts` also clears the cache

### Logout — Moved out of header
**Files:** `frontend/src/components/Layout.tsx`
- Logout button removed from the top-level header bar
- Replaced with a profile dropdown (chevron next to user name) containing: **View profile**, **Settings**, **Log out**
- Dropdown closes on click-outside via `mousedown` listener

---

## 2. Navigation & Layout

### Sidebar — Sticky positioning
**Files:** `frontend/src/components/Layout.tsx`
- Sidebar is now `sticky top-[3.5rem]` so it stays fixed in the viewport while page content scrolls

### Sidebar — Collapse / icon-only mode
**Files:** `frontend/src/components/Layout.tsx`
- Desktop (≥1024px): sidebar collapses to 64px icon-only strip when not hovered; expands to 240px on hover with smooth CSS transition
- Mobile (<1024px): original hamburger-toggle behaviour preserved
- Nav labels hidden when collapsed; `title` attribute added for accessibility hover tooltips
- Footer CTA and user info fade out when collapsed

### Dashboard — Right-side padding alignment
**Files:** `frontend/src/pages/Dashboard.tsx`
- Fixed uneven spacing between the main content column and the right aside column
- Changed from generic `lg:grid-cols-3` + `col-span-2` to an explicit `lg:grid-cols-[1fr_280px]` layout

---

## 3. Search

### Search filters — Sizing & mobile collapse
**Files:** `frontend/src/pages/Search.tsx`
- Filter rail width reduced from 240px to 200px
- On mobile/tablet (<1024px): filters hidden by default behind a toggle button with animated chevron
- Desktop: filters always shown, restored on resize above 1024px
- Resize handler now correctly collapses filters when shrinking back to mobile (previously only opened on grow)

### Search filters — Auto-collapse after results load
**Files:** `frontend/src/pages/Search.tsx`
- Filters automatically collapse when search results load, giving the full width to results
- "Show filters" link appears in the results header when filters are collapsed, letting users reopen without scrolling up

---

## 4. Feed & Content

### Like button — Dark/filled state + toggle
**Files:** `frontend/src/pages/Feed.tsx`, `frontend/src/pages/Reels.tsx`
- Like button now shows a filled, brand-coloured heart when the user has liked a post/reel (was always outline)
- Toggling: clicking a liked post sends `DELETE /posts/:id/like` (unlike); clicking an unliked post sends `POST` (like)
- Optimistic UI: heart toggles instantly; reverts on API error

### Comments — Duplicate display fix
**Files:** `backend/src/modules/posts/posts.service.ts`, `frontend/src/components/CommentSection.tsx`
- Backend: `listComments` order changed from `desc` to `asc` (oldest first, newest at bottom — expected reading order)
- Frontend: comments deduplicated by ID using a `Map` before rendering, preventing any React Query edge-case from showing the same comment twice

---

## 5. Profile & Settings

### Photo upload — In-place progress indicator
**Files:** `frontend/src/pages/EditProfile.tsx`
- Profile photo: "Uploading…" text now appears inside the circular avatar frame while uploading (replaces the photo with a dark overlay + label)
- Cover photo: full-bleed dark overlay with centred "UPLOADING…" text while uploading
- Camera icon buttons disabled and visually greyed out during upload
- Removed the plain `<p>Uploading photo…</p>` text that appeared below the photos

### Country — Dropdown in profile editor
**Files:** `frontend/src/pages/EditProfile.tsx`
- Country field changed from free-text `<input>` to a `<select>` dropdown matching the signup page options

### Country & State — US / India state dropdowns
**Files:** `frontend/src/data/geo.ts` *(new)*, `frontend/src/pages/Signup.tsx`, `frontend/src/pages/EditProfile.tsx`
- Created shared `geo.ts` with `COUNTRIES`, `US_STATES` (50 states), `INDIA_STATES` (33 states/UTs), and `statesForCountry()` helper
- When **United States** or **India** is selected, the State field switches from a free-text input to a dropdown populated with the correct list
- Changing country clears the state field to prevent stale values
- **United States** added to both Signup and EditProfile country lists

### Saved opportunities — New feature
**Files:** `frontend/src/store/savedOpportunities.ts` *(new)*, `frontend/src/pages/Opportunities.tsx`, `frontend/src/pages/Profile.tsx`
- Bookmark toggle added to every opportunity card in the Opportunities list (filled orange bookmark = saved)
- Saved state persisted to localStorage via a Zustand `persist` store — survives page refresh and syncs across all components
- New **Saved (n)** tab added to your own profile page, listing all bookmarked opportunities with deadline countdown and a Remove button
- Empty state links to the Opportunities page

---

## 6. Messages

### Demo conversations
**Files:** `frontend/src/pages/Messages.tsx`
- When the inbox has no real conversations, three realistic demo conversations are shown:
  - Priya Verma (Scout · Mumbai) — cricket trials thread with unread badge
  - Chennai FC Academy — club enquiry
  - Rahul Mehta (Athlete · Delhi) — joint training session
- "Demo preview" label shown at top of inbox; "Sample data · Find a user" footer links to Search
- Compose box disabled for demo conversations; navigating away and returning shows demo again until a real conversation exists
- Demo data is memoized — timestamps don't jitter on polling re-renders

---

## 7. Error Handling

### Backend — Human-readable Zod validation errors
**Files:** `backend/src/middleware/errorHandler.ts`
- Zod field errors are now cleaned before reaching the client:
  - `"String must contain at least 8 character(s)"` → `"Must be at least 8 characters"`
  - `"Expected string, received undefined"` → `"This field is required"`
  - `"Invalid email"` → `"Must be a valid email address"`
  - `"Invalid url"` → `"Must be a valid URL"` — and more
- Summary message built from field names: single field → `"Password: Must be at least 8 characters"`; multiple → `"Please fix the following: Email, Password, Phone"`
- Error code changed from `"UNPROCESSABLE"` to `"VALIDATION"`

### Frontend — `humanizeError` utility
**Files:** `frontend/src/api/client.ts`, all page files
- New `humanizeError(err)` export in `client.ts` — single function that produces a display-ready string for any error type:
  - No server response → `"Unable to reach the server. Check your connection and try again."`
  - Validation field errors → `"Field Name: first error message"` (joined with ` · ` for multiple fields)
  - Guarded against `undefined` messages in empty fieldErrors arrays
- Replaced all `getApiError(e).message` and `JSON.stringify(er.details)` calls across every page with `humanizeError(e)` — no page ever dumps raw JSON or technical error objects at the user again

### Login — Network error messaging
**Files:** `frontend/src/pages/Login.tsx`
- Network errors (server unreachable, CORS blocked) now show: *"Unable to reach the server. Check your internet connection or try again in a moment."* instead of raw Axios `"Network Error"` string

### API client — Interceptor fix
**Files:** `frontend/src/api/client.ts`
- Fixed 401 retry interceptor: `headers` spread correctly on retried requests (was replacing the entire headers object, silently dropping `Content-Type`)
- `getApiError` now distinguishes no-response errors (code `"NETWORK"`) from server-responded errors (code `"HTTP_4xx"`)

---

## 8. Code Review Fixes (automated review pass)

### Rules of Hooks violation — Layout.tsx
**Files:** `frontend/src/components/Layout.tsx`
- `useQueryClient()` was called after `if (!user) return <Outlet />`, violating React's Rules of Hooks
- Symptom: React would throw "Rendered fewer hooks than expected" whenever user session state transitioned, crashing the app shell
- Fix: moved `const qc = useQueryClient()` above the early return with all other hooks

### Stale `window.innerWidth` reads in JSX — Layout.tsx
**Files:** `frontend/src/components/Layout.tsx`
- Three places read `window.innerWidth` directly in JSX style/class expressions — these are snapshots captured at render time and never update when the browser is resized
- Symptom: sidebar width, nav collapse state, and footer visibility all stuck at mount-time viewport after any resize
- Fix: added `isDesktop` state (initialized + updated by the existing resize listener); all three JSX sites now read `isDesktop` from state

### Non-athlete signup "Primary contact role" writing into `dob` field
**Files:** `frontend/src/pages/Signup.tsx`
- Non-athlete variant of the date-of-birth row had `value={d.dob}` and `onChange` writing to `dob`, so typing "Club Manager" in the "Primary contact role" field stored it as the date-of-birth
- Fix: removed the non-athlete variant entirely (clubs have no need for a DOB or contact-role field in signup)

### `useSavedOpportunities` — Independent state per component
**Files:** `frontend/src/store/savedOpportunities.ts`
- Previously used `useState` initialised from localStorage — each component call created an isolated copy; saving in Opportunities.tsx was invisible to Profile.tsx until a remount
- Fix: converted to a Zustand `persist` store (same pattern as `useAuthStore`), giving all consumers one shared reactive instance

### `makeDemoData` rebuilt on every render — Messages.tsx
**Files:** `frontend/src/pages/Messages.tsx`
- Called unconditionally on every render including 5-second polling ticks, allocating new `Date` objects each time even when demo mode was inactive
- Fix: wrapped with `useMemo(() => makeDemoData(me.id), [me.id])`

### `humanizeError` — `undefined` guard
**Files:** `frontend/src/api/client.ts`
- When `fieldErrors` contained an empty messages array, `msgs[0]` was `undefined`, producing the string `"FieldName: undefined"` on screen
- Fix: null-check before interpolation, falls back to field label or top-level message

---

## Files Changed

| Area | Files |
|---|---|
| Auth & session | `frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`, `frontend/src/api/client.ts`, `frontend/src/main.tsx`, `frontend/src/store/auth.ts` |
| Layout & navigation | `frontend/src/components/Layout.tsx` |
| Dashboard | `frontend/src/pages/Dashboard.tsx` |
| Feed | `frontend/src/pages/Feed.tsx` |
| Reels | `frontend/src/pages/Reels.tsx` |
| Search | `frontend/src/pages/Search.tsx` |
| Profile & edit | `frontend/src/pages/Profile.tsx`, `frontend/src/pages/EditProfile.tsx` |
| Opportunities | `frontend/src/pages/Opportunities.tsx`, `frontend/src/pages/OpportunityDetail.tsx` |
| Messages | `frontend/src/pages/Messages.tsx` |
| Comments | `frontend/src/components/CommentSection.tsx` |
| Saved opps store | `frontend/src/store/savedOpportunities.ts` *(new)* |
| Geo data | `frontend/src/data/geo.ts` *(new)* |
| Error handling | `backend/src/middleware/errorHandler.ts`, `frontend/src/api/client.ts` |
| Backend posts | `backend/src/modules/posts/posts.service.ts` |
| Other pages | `frontend/src/pages/NewBlog.tsx`, `NewOpportunity.tsx`, `NewOrganization.tsx`, `NewTournament.tsx`, `ResetPassword.tsx`, `VerifyEmail.tsx` |
