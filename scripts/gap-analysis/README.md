# Daily gap analysis

## What it does

`gap-analysis.mjs` scans the repo for four categories of gaps:

| Area | Checks |
|---|---|
| **feature** | PPTX cricket-scoring fields present in schema + UI |
| **security** | `npm audit` per package, secret patterns in tracked files, helmet missing, `.env` tracked, CORS `*` |
| **production** | `/healthz` + `/readyz` probes, structured logging, rate limit, graceful shutdown, APM presence, CI coverage |
| **architecture** | duplicate prisma schemas, README freshness (>90d), Mermaid diagram presence, optional Storybook |

Each finding is scored P0–P3. The script exits with code `2` if there are any P0 findings — wired so the GH Action fails loudly.

## How to run locally

```bash
node scripts/gap-analysis/gap-analysis.mjs
# → reports/gap-analysis/YYYY-MM-DD.md   (human-readable)
# → reports/gap-analysis/YYYY-MM-DD.json (machine-readable)
# → reports/gap-analysis/latest.md
```

The script makes no network calls beyond `npm audit` (which reads the lockfile and queries the registry). Safe to run on a fork.

## How the schedule works

The workflow at `.github/workflows/daily-gap-analysis.yml` runs:
- **Daily at 07:30 UTC** (≈ 13:00 IST) on a cron trigger
- **On every push to `main`** that touches the script or the workflow itself
- **On demand** via Actions → Daily gap analysis → Run workflow

After each run it:
1. Uploads the report as an artifact (90-day retention).
2. Commits today's report to `reports/gap-analysis/` on main so the history is searchable in git.
3. Creates or updates a single tracking issue titled `🔍 Daily gap analysis tracker` (label: `gap-analysis`), so the team sees the current state at a glance without spam.
4. Fails the workflow run if any P0 finding is present.

## Adding a new check

Edit `gap-analysis.mjs`. The pattern is:

```js
function myAreaGaps() {
  if (!somethingExpected) {
    add("P1", "production", "Title for the dashboard",
        "path/to/evidence:42",
        "What the engineer should do to fix it");
  }
}
```

Then call it from the bottom of the file alongside the other section functions.

Avoid emitting findings that aren't actionable — every P1+ finding is something we should be willing to take a sprint slot on.

## Suppressing a finding

There's no allowlist file by design — if a check is too noisy, fix the check (e.g. tighten the regex or scope it to specific files). Allowlist files rot silently; smarter checks don't.
