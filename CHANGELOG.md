# Changelog

All notable changes to Sportivox are documented here.

---

## [Unreleased] — 2026-05-28

### Frontend

#### Layout & Navigation
- **Hamburger menu now closed by default on mobile** — sidebar opens on desktop (≥1024 px) and collapses on smaller screens. A resize listener automatically reopens it when the viewport grows to desktop width. Clicking a nav item on mobile closes the sidebar.

#### Search (`Search.tsx`)
- **Radius / distance filter** — new radius input with a km / miles toggle appears below the city field. The radius is disabled until a city is entered and is converted to kilometres before being sent as `radius_km` to the API. A hint is shown when radius is typed without a city.

#### Opportunities (`Opportunities.tsx`)
- **Improved type dropdown labels** — raw snake_case values replaced with human-readable labels: Trial, Recruitment, Scholarship, Tournament, Coaching Job. The same labels are used in the badge on each opportunity card.

#### Profile (`Profile.tsx`)
- **Followers & Following tabs** — the profile page now has three tabs (Posts, Followers, Following). Followers and Following tabs fetch the respective lists from the API and render user cards with avatar, name, and role badge. Tab headers show the live counts from the user object.

#### Edit Profile (`EditProfile.tsx`)
- **Profile photo upload** — camera button overlaid on the avatar circle. Selecting a file triggers a GCS signed-URL upload and immediately saves `profile_photo_url` via `PUT /users/me`.
- **Cover photo upload** — camera button on the cover gradient. Same upload flow saves `cover_photo_url`.
- Both uploads update the Zustand auth store so the header avatar refreshes without a page reload.

#### Login (`Login.tsx`)
- **Resend verification email prompt** — when login fails with an "Email not verified" error, an amber banner appears with a "Resend verification email" button. On success a green confirmation replaces it.

#### Signup (`Signup.tsx`)
- **Email already exists — resend option** — when signup fails because the email is already registered, an amber banner offers to resend the verification email, covering the case where a user signed up previously but never verified.

#### My Organizations (`MyOrganizations.tsx`)
- **Error state** — the page now shows an explicit error message when the organization list query fails, instead of silently displaying an empty list.

---

### Backend

#### `organizations.service.ts`
- **Fix: organization list for club users** — `listOrganizationsForOwner` previously used `.orderBy("created_at", "desc")` which requires a composite Firestore index that was not deployed. The query now fetches without `orderBy` and sorts the result in memory. This resolves the bug where club users saw "No organizations yet" after successfully creating one.

#### `follow.service.ts`
- **Fix: followers / following lists** — `listFollowers` and `listFollowing` had the same missing composite index issue. Both now fetch without `orderBy` and sort docs in memory before resolving user profiles. The unused `cursor` parameter is retained in the signature for API compatibility but pagination is disabled until indexes are deployed.

---

### Known Limitations
- The radius filter is passed to the API but the search backend does not currently perform geo-proximity filtering — results are still returned by keyword/city match. A geo-index (e.g. Firestore GeoPoint + GeoHash) would be needed to make radius filtering functional end-to-end.
- Email delivery on signup requires `SENDGRID_API_KEY` to be configured in GCP Secret Manager. Without it the verification link is logged server-side but not delivered. Use the "Resend verification email" flow as a workaround once the key is set.
- Profile photo and cover photo are uploaded directly to the public GCS media bucket. The URLs are permanent public links (`https://storage.googleapis.com/…`).
