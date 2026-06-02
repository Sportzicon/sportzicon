# Cricket scoring — PPTX features implementation

Branch: `feature/cricket-scoring-and-automation`
Source spec: `cricket_features_parameters.pptx` (May 2026 v1.0)
Audience: Organizers (and scorers they delegate to). Athletes/clubs/scouts read it via existing routes.

This doc captures **what changed and why**, at a level a senior developer can review without diffing every file.

---

## 1 · Scope decision

The PPTX is a cricket-scoring brief. The repo already has a dedicated `scoring/` subproject with its own Postgres / Prisma / Express / React stack and roles (`admin`, `organizer`, `scorer`, `viewer`). The main Sportivox app is the discovery & networking surface and reuses `opportunities` of type `tournament` for listings.

We chose **"both, linked"**: implement the PPTX features inside `scoring/` (where the data model already exists) and add a link from the main Sportivox `Tournaments` page so organizers click through with one tap. This avoids duplicating cricket models inside the Sportivox main backend, which is Firestore-oriented and not designed for ball-level mutations.

---

## 2 · Data model changes (scoring/backend/prisma/schema.prisma)

### Tournament — match & innings setup (PPTX §02)

| Field | Purpose |
|---|---|
| `overs_per_innings` `Int?` | T20 → 20, ODI → 50, custom |
| `number_of_innings` `Int?` | 2 (LO) or 4 (Test) |
| `ball_type` `String?` | red / white / pink |
| `powerplay_overs` `Json?` | `{ pp_end, mid_end, death_end }` — drives phase analytics |
| `super_over_enabled`, `dls_enabled`, `free_hit_enabled`, `retired_hurt_allowed`, `substitutes_allowed` | Rule toggles |
| `no_ball_rule`, `wide_rule`, `tie_break_rule` | Enum-as-string |

### Innings — phase splits + derived metrics (PPTX §02 · Team Analytics)

Adds denormalised counters that would otherwise need to be re-aggregated on every read:

- `penalty_runs`, `boundary_4s`, `boundary_6s`, `dot_balls`
- Per-phase: `pp_runs / pp_balls / pp_wickets`, `mid_*`, `death_*`
- Derived: `projected_score`, `win_probability`, `momentum_index` (all recomputed each ball)

### BallEvent — Level 1 + Level 2 capture (PPTX §05)

This is the heart of the change. Every delivery now records:

**Level 1 (mandatory every ball):**
`shot_type`, `ball_line`, `ball_length`, `bowler_variant`, `delivery_outcome`, `phase`, `is_free_hit`, `is_dot`, `non_striker_id`, `is_penalty`.

**Level 2 (expanded on wicket only):**
`fielder_name` (free-text fallback), `fielding_position`, `dismissal_zone`, `ball_trajectory`, plus the existing `wicket_type`, `dismissed_player_id`, `fielder_id`.

Three new indexes power analytics queries fast:
- `(innings_id, phase)` — phase-wise queries
- `(bowler_id, ball_length)` — pitch map
- `(bowler_id, ball_line)` — line distribution

### BattingEntry — dismissal context + scouting (PPTX §02)

- Shot detail counters: `dot_balls`, `singles`, `doubles`, `threes`
- Dismissal denormalisation for the scorecard view: `dismissal_shot`, `dismissal_line`, `dismissal_length`, `dismissal_bowler_type`, `dismissal_zone`, `dismissal_trajectory`, `dismissal_fielding_position` — set when the dismissing ball is recorded so the scorecard query stays single-row.
- Post-match scouting tags: `strong_zone`, `weak_zone`, `strength_vs`, `preferred_zone`, `scouting_notes`.

### BowlingEntry — spell + phase splits (PPTX §03)

- `dot_balls`, `boundaries_4s`, `boundaries_6s`
- Spell tracking: `spell_number`, `spell_start_over`, `spell_end_over`
- Per-phase: `pp_runs / pp_balls / pp_wickets`, `mid_*`, `death_*` — phase-wise economy is now O(1) read

### FieldingEntry (NEW) — PPTX §04

Per-innings fielding aggregates: `catches`, `drops`, `run_outs_direct`, `run_outs_assist`, `stumpings`, `direct_hits`, `misfields`, `assists`, `impact_score`.

### Partnership (NEW) — PPTX §02 · Partnership runs & balls (live)

`wicket_number`, `player1_id`, `player2_id`, `runs`, `balls`, `fours`, `sixes`, `is_unbroken`, `ended_over`, `ended_ball`.

Migration SQL: `scoring/backend/prisma/migrations/20260531_cricket_pptx_features/migration.sql` (additive only — no destructive ops, no defaults that would lock long-running tables on rollout).

**Developer note:** the migration uses `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` to be re-entrant on environments where the prisma migrate history isn't synced.

---

## 3 · API changes (scoring/backend/src/modules/scoring/)

### New endpoints (all under `/api/...`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| `POST` | `/innings/:id/balls/undo` | organizer · admin · scorer | Reverse the last ball (PPTX §02 — Undo last ball) |
| `GET` | `/innings/:id/analytics` | public | Dismissal patterns, length/line/shot distribution, phase splits, derived metrics |
| `GET` | `/innings/:id/partnerships` | public | All partnerships in this innings |
| `GET` | `/players/:id/scouting` | public | Per-player breakdown by length and bowler variant + saved scouting tags |
| `PUT` | `/innings/:id/scouting/:playerId` | organizer · admin · scorer | Save post-match scouting tags |
| `GET` | `/innings/:id/fielding` | public | Per-player fielding leaderboard |
| `POST` | `/innings/:id/fielding` | organizer · admin · scorer | Log standalone fielding events (drops, misfields, assists) |
| `PUT` | `/matches/:id/config` | organizer · admin | Update tournament-level match configuration |

### `addBall` — what's new

The ball-recording handler now:
1. Computes `phase` at write time using `tournament.powerplay_overs` (falls back to format defaults — T20 → 6/15/20, ODI → 10/40/50).
2. Persists every PPTX dropdown directly on the ball row.
3. Increments per-phase counters on both `Innings` and `BowlingEntry` so reads stay O(1).
4. Increments `dot_balls`, `boundary_4s/6s`, `singles/doubles/threes` on both batter and innings.
5. On wicket, denormalises dismissal context (shot/line/length/zone/trajectory/fielding position/bowler type) onto the dismissed player's `BattingEntry`. This means the scorecard view (PPTX §05 — *"c Slip (1st) b Hazlewood · Cut shot · Outside off · Back of length · RFM"*) is a single-row read.
6. Auto-creates / updates a `FieldingEntry` row for catches, run-outs and stumpings credited to the on-roster fielder.
7. Tracks partnerships through `updatePartnerships`: opens one for the on-strike + non-striker, accumulates runs/balls/4s/6s, marks `is_unbroken = false` on dismissal.
8. Recomputes derived metrics (`projected_score`, `win_probability`, `momentum_index`) using the latest 12-ball window for momentum.

### `undoLastBall` — symmetric reversal

Every `{ increment: x }` in `addBall` has a corresponding `{ decrement: x }` in `undoLastBall`. The ball row itself is deleted last. This is intentionally not a soft-delete because the user-facing semantic is "I tapped the wrong button" — keeping it around invites bugs.

### `winProbability` / `projectedScore` / `momentumIndex`

These are heuristics, **not** ML models — by design for v1:
- **Projected score** = current run rate × total balls in innings.
- **Win probability** is logistic-ish on RRR + wickets in hand (chase) or projected score vs par (first innings).
- **Momentum index** is a weighted average of the last 12 balls (boundaries pull up, wickets/dots pull down).

If the business wants Sportivox-grade WP later, plug a model behind the same function signature — no UI changes needed.

---

## 4 · Frontend changes (scoring/frontend/src/)

### `data/cricket.ts` (NEW)

Single source of truth for every dropdown vocabulary in the PPTX. Sharing one constants file across Level 1, Level 2, scouting and the analytics view means the analytics dashboard can never drift from what the scorer entered.

### `pages/LiveScoring.tsx` — Level 1 + Level 2 panels

- Added Level 1 row (mandatory): **Ball Length · Ball Line · Bowler Type · Shot Type** (PPTX §05).
- Bowler-type dropdown uses the compact 6-option list (`ra_pace`, `la_pace`, `off_spin`, `leg_spin`, `la_orth`, `la_wrist`) and maps to the full 15-variant list at submit time via `bowlerVariantFromShort`.
- Added **non-striker** select so partnerships have both players.
- Added **Free Hit** toggle in extras row.
- Replaced legacy 3-field wicket details with the full Level 2 panel: dismissal type · batsman out · fielder (from roster or free-text) · fielding position · dismissal zone · ball trajectory.
- Scoreboard now shows the **derived metric strip**: CRR · RRR · Projected · Win % · 4s/6s · Dots.
- New buttons: **Undo** (calls `POST /innings/:id/balls/undo`) and **Analytics** (deep-link to the new analytics page).

### `pages/InningsAnalytics.tsx` (NEW)

The PPTX "Analytics — Key Numbers" board. Shows:
- Four hero stat cards: dismissed outside off %, wickets off spin %, wickets off pace %, win probability.
- Phase performance grid (PP / Middle / Death runs · wkts · economy).
- Length distribution chart (bar per length bucket — balls, runs, wickets).
- Line distribution chart.
- Shot distribution.
- Partnerships table (one row per wicket, marks unbroken stand).
- Fielding leaderboard (catches/drops/run-outs/stumpings/misfields/impact).

Auto-refreshes every 10s.

### `pages/MatchConfig.tsx` (NEW)

Organizer-only screen at `/matches/:id/config`. Drives all of PPTX §02 *Match & Innings Setup*: overs · innings count · ball type · phase boundaries · super-over · DLS · free-hit · retired-hurt · substitutes · no-ball rule · wide rule · tie-break rule. Saves to the parent tournament via `PUT /matches/:id/config`.

### `App.tsx` — new routes

- `/matches/:matchId/config` → MatchConfig (protected)
- `/innings/:inningsId/analytics` → InningsAnalytics

### Link from main Sportivox app

`frontend/src/pages/Tournaments.tsx` now shows organizers a callout panel with a deep link to the scoring console (URL configurable via `VITE_SCORING_URL`, defaults to `/scoring/`).

---

## 5 · What's intentionally NOT in this PR

Holding for v1.1 once the core capture flow is validated:
- **Pitch map (heatmap) visualisation** — data is captured (line × length grid is queryable), but only bar charts ship now to avoid a charting library dependency.
- **Wagon wheel SVG** — shot distribution ships as a bar chart of `shot_type`. Drawing a 360° wagon wheel needs ground coordinates we don't collect (it's not in the PPTX dropdown list).
- **Substitute / impact-player tracking** — config flag is wired, runtime player swap UI is not.
- **DLS calculation** — flag enables it; the calc itself is out of scope.
- **Spell auto-detection** — bowler `spell_number` exists in the schema; the auto-detector (new spell after a 1-over break) is not in addBall yet.

---

## 6 · How to roll this out

```bash
# 1) inside scoring/backend (the dedicated cricket scoring app)
npm install
npx prisma migrate deploy          # applies migrations/20260531_cricket_pptx_features
npx prisma generate
npm run dev                        # exercises new endpoints

# 2) inside scoring/frontend
npm install
npm run dev

# 3) set VITE_SCORING_URL in the main Sportivox frontend .env if scoring is on a different domain
echo "VITE_SCORING_URL=https://scoring.sportivox.com" >> frontend/.env.local
```

The migration is additive only — safe to run on a live database. The new fields default to 0 / null / false, so existing rows continue to render with the legacy zero-state.

---

## 7 · Open questions for product

1. **Bowler type granularity** — Level 1 uses the 6-option short list (PPTX §05). The PPTX §03 parameters table also lists 15 variants. We map short → variant at submit. Do scouts also need to *enter* the full variant directly during live scoring, or only see it in analytics?
2. **Win probability calibration** — current heuristic is plenty for v1. When should we revisit with a model trained on past matches?
3. **Free-hit auto-trigger** — currently the scorer ticks the Free Hit box manually after a front-foot no-ball. Worth adding an automatic flag for the *next legal* ball?
