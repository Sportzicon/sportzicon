# Sportivox — API Surface

Base URL: `<api-host>/api/v1`

All endpoints require `Authorization: Bearer <access_token>` unless tagged **public**.

## Auth

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/auth/signup` | `{email, password, full_name, phone, role}` | **public** — `role` cannot be `admin` |
| POST | `/auth/login` | `{email, password}` | **public** |
| POST | `/auth/refresh` | `{refresh_token}` | **public** — single-use, rotates |
| POST | `/auth/logout` | `{refresh_token?}` | revokes the refresh token |
| POST | `/auth/verify-email` | `{token}` | **public** |
| POST | `/auth/resend-verification` | `{email}` | **public** |
| POST | `/auth/forgot-password` | `{email}` | **public** — always 200 |
| POST | `/auth/reset-password` | `{token, password}` | **public** — invalidates all sessions |
| POST | `/auth/change-password` | `{currentPassword, newPassword}` | invalidates all sessions |
| GET  | `/auth/me` | — | current user |

## Users / Profiles

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/users/:id` | view any user |
| PUT  | `/users/me` | update basics (name, bio, location, dob, gender, phone, photos) |
| PUT  | `/users/me/athlete` | athletes only — sport stats, position, experience, availability |
| PUT  | `/users/me/coach` | scouts/organizers — specialization, regions |

## Follow

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/follow/:id` | follow user (idempotent) |
| DELETE | `/follow/:id` | unfollow |
| GET    | `/follow/status/:id` | `{following: boolean}` |
| GET    | `/follow/:id/followers` | paged |
| GET    | `/follow/:id/following` | paged |

## Organizations

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/organizations` | clubs/organizers only |
| GET    | `/organizations/mine` | orgs owned by current user |
| GET    | `/organizations/:id` | view |
| PUT    | `/organizations/:id` | owner or admin |

## Opportunities

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/opportunities` | clubs/organizers only |
| GET    | `/opportunities` | filters: sport, type, country, city, status, org_id |
| GET    | `/opportunities/:id` | auto-closes if deadline passed |
| PUT    | `/opportunities/:id` | poster or admin |
| DELETE | `/opportunities/:id` | poster or admin |

## Applications

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/opportunities/:opportunityId/apply` | athletes only; one per (athlete, opp) |
| PATCH  | `/applications/:id/status` | `{status, reason?}` — RBAC + state-machine enforced |
| GET    | `/applications/mine` | applicant view |
| GET    | `/applications/:id` | applicant, poster, or admin |
| GET    | `/opportunities/:opportunityId/applicants` | poster or admin |

## Search

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/search/players` | filters: q, sport, country/state/city, gender, age_min/max, experience_level, availability, verified |
| GET    | `/search/clubs` | filters: q, sport, country/state/city, org_type, verified |
| GET    | `/search/opportunities` | filters: q, sport, type, country/city, status |

## Messaging

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/conversations` | inbox |
| POST   | `/messages` | `{recipient_id, body}` — creates conv if absent |
| GET    | `/conversations/:id/messages` | participants only |
| POST   | `/conversations/:id/read` | mark conversation read |

## Notifications

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/notifications` | `?unread=true` to filter |
| GET    | `/notifications/count` | `{unread: number}` |
| POST   | `/notifications/read` | `{ids?: string[]}` — empty array = mark all |

## Posts (activity logs + general)

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/posts` | `{type: "log"\|"post", text, media_urls?, sport?, tags?}` |
| GET    | `/posts` | `?author_id, sport, type, cursor, limit` |
| GET    | `/posts/feed` | your posts + people you follow |
| DELETE | `/posts/:id` | author or admin |
| POST   | `/posts/:id/like` / `DELETE` |
| GET / POST | `/posts/:id/comments` |

## Reels

Identical shape to posts: `POST /reels`, `GET /reels`, `DELETE`, `POST /reels/:id/view`, like/unlike, comments.

## Blogs

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/blogs` | draft or published |
| GET    | `/blogs` | published only by default |
| GET    | `/blogs/:idOrSlug` | id or slug; bumps view count |
| PUT    | `/blogs/:id` | author or admin |
| DELETE | `/blogs/:id` | author or admin |
| Like / comments as for posts |

## AI tips

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/ai/athlete-tips` | athlete only; per-user rate limit (30s, 20/day) |

## Media uploads

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/media/upload-url` | returns a signed PUT URL with content-type + length constraints |
| GET    | `/media/read-url` | signed read URL for private docs |

## Verification

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/verifications` | user or org owner — submit documents |
| GET    | `/verifications/pending` | admin |
| POST   | `/verifications/:id/review` | admin — `{decision, reason?}` |

## Reports

| Method | Path | Notes |
|--------|------|-------|
| POST   | `/reports` | any authenticated user can report abuse |

## Admin (admin role required)

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/admin/users` | paged, with status/role filters |
| PATCH  | `/admin/users/:id/status` | activate / suspend / pending |
| PATCH  | `/admin/users/:id/badges` | set verification badges |
| GET    | `/admin/reports` | list reports |
| PATCH  | `/admin/reports/:id` | resolve report |
| GET    | `/admin/audit-logs` | full audit trail |
| GET    | `/admin/analytics` | platform totals |

## Health

| Method | Path | Notes |
|--------|------|-------|
| GET    | `/healthz` | liveness — used by Cloud Run |
| GET    | `/readyz` | readiness — used by Cloud Run startup probe |

## Error format

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human-readable description",
    "details": { /* optional, e.g. zod flatten() output */ }
  }
}
```

Codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNPROCESSABLE`, `RATE_LIMITED`, `INTERNAL`.
