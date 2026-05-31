# Sportivox · End-to-end test suite

Playwright covering both apps in this monorepo:

- **`tests/sportivox/`** — landing, auth, opportunities, social surfaces (feed, reels, blogs, notifications, messages).
- **`tests/scoring/`** — login, tournament CRUD, live scoring (PPTX Level 1 + Level 2), undo, analytics dashboard, match configuration screen.

## What's covered

| Tag | Purpose |
|---|---|
| `@smoke` | Quick "is the page even up?" — runs in <60s |
| `@critical` | Golden-path scenarios. A regression here blocks ship |
| `@auth` | Authentication paths |
| `@scoring` | Anything in the cricket scoring console |

PPTX-specific scenarios covered by `tests/scoring/live-scoring.spec.ts` and `tests/scoring/analytics.spec.ts`:

1. **Record Level 1 ball** — selects ball length, ball line, bowler type and shot type, then taps a run button. Verifies the success toast and that the innings counter advances.
2. **Record a boundary 4** — verifies the boundary counter on the innings increments.
3. **Record a Level 2 wicket (caught)** — exercises the wicket panel with dismissal type, fielding position, dismissal zone and ball trajectory.
4. **Undo last ball** — verifies the symmetric reversal endpoint and UI feedback.
5. **Derived metrics strip** — asserts CRR / Proj / Win % are rendered on the live scoreboard.
6. **Analytics dashboard** — sets up an over via the API, then verifies all six analytics sections (dismissal patterns, phase performance, length / line / shot distribution, partnerships, fielding impact).
7. **Match configuration screen** — verifies all PPTX § Match Setup sections render and the form saves.

## Running locally

```bash
cd e2e
npm install
npx playwright install --with-deps chromium

# Both apps need to be running. In separate terminals:
#   cd backend && npm run dev          # Sportivox API
#   cd frontend && npm run dev         # Sportivox web (http://localhost:5173)
#   cd scoring/backend && npm run dev  # Scoring API
#   cd scoring/frontend && npm run dev # Scoring web (http://localhost:5174)

# Then:
npm test                # full suite
npm run test:smoke      # @smoke only
npm run test:critical   # @critical only
npm run test:scoring    # cricket scoring tests
npm run test:ui         # interactive UI
npm run report          # open last HTML report
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SVOX_BASE_URL` | `http://localhost:5173` | Sportivox web base URL |
| `SCORING_BASE_URL` | `http://localhost:5174` | Scoring web base URL |
| `SCORING_API_URL` | `http://localhost:8081/api` | Scoring API for test setup |
| `SVOX_DEMO_PASSWORD` | `Demo1234!` | Password for `make seed` demo users |
| `SCORING_ADMIN_EMAIL` | `admin@scoring.local` | Admin account on scoring |
| `SCORING_ADMIN_PASSWORD` | `Demo1234!` | …password |

## Daily CI run

`.github/workflows/daily-e2e.yml` runs the suite at 03:00 UTC every day against `secrets.SVOX_STAGING_URL` / `secrets.SCORING_STAGING_URL`. It:

1. Runs `npx playwright test --reporter=list,html,json,junit`.
2. Uploads HTML report and JUnit XML as 30-day artifacts.
3. Commits a one-page Markdown summary to `reports/e2e/YYYY-MM-DD/`.
4. Updates a single rolling GitHub issue titled "🧪 Daily Playwright e2e tracker".
5. Fails the workflow if any test failed.

## Skipping vs failing

Tests skip (not fail) when:
- Seed data isn't loaded (`make seed`).
- The scoring API isn't reachable (`SCORING_API_URL` 404s).
- A control isn't visible in the current build (e.g. a feature still being rolled out).

This keeps daily runs green when external prerequisites are missing — fail loudly only on regressions in code we control.

## Adding a scenario

1. Drop the spec into the right subfolder (`sportivox/` or `scoring/`).
2. Tag it with at least one of `@smoke`, `@critical`, `@auth`, `@scoring` so the selector scripts pick it up.
3. Prefer setting up state through the API (see `setupMatch()` in `live-scoring.spec.ts`) rather than chaining UI flows — faster, less brittle.
4. Avoid `page.waitForTimeout(...)` except as a last-resort backstop after a real assertion.

## Known gaps

- Mobile viewport coverage is currently limited to the landing page. Worth expanding once the responsive design is locked down.
- No visual regression baseline — Playwright supports it (`toHaveScreenshot`) but baselines weren't pinned in this PR to avoid noisy diffs.
- No load tests (out of scope for daily Playwright; would need k6 or similar).
