#!/usr/bin/env node
// Daily gap analysis report for Sportivox.
// Runs from the repo root and writes reports/gap-analysis/YYYY-MM-DD.md.
//
// Sections (PPTX-aligned scope):
//   1. Feature gaps        — checks the cricket scoring brief vs. the codebase
//   2. Security gaps       — npm audit, secrets pattern scan, common misconfig
//   3. Production gaps     — health checks, observability, env mgmt, CI/CD posture
//   4. Architecture gaps   — coupling, dead code candidates, doc freshness
//
// Each finding is emitted with: severity (P0/P1/P2/P3) · area · title · evidence · suggestion.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(process.cwd());
const REPORT_DIR = join(ROOT, "reports", "gap-analysis");
const TODAY = new Date().toISOString().slice(0, 10);

const findings = [];
const sevWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };

function add(sev, area, title, evidence, suggestion) {
  findings.push({ sev, area, title, evidence, suggestion });
}

function readSafe(path) {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
}

function listFiles(dir, exts = [".ts", ".tsx", ".js", ".mjs", ".yml", ".yaml", ".md", ".json", ".prisma"], skip = new Set(["node_modules", ".git", "dist", "build", ".next", "coverage", "reports"])) {
  const out = [];
  function walk(d) {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      if (skip.has(name)) continue;
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else if (exts.some(e => name.endsWith(e))) out.push(p);
    }
  }
  walk(dir);
  return out;
}

function grep(pattern, files) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  const hits = [];
  for (const f of files) {
    const t = readSafe(f);
    if (re.test(t)) hits.push(f);
  }
  return hits;
}

// ─── 1 · Feature gaps (PPTX coverage) ─────────────────────────────────────────

function featureGaps() {
  const schema = readSafe(join(ROOT, "scoring/backend/prisma/schema.prisma"));
  // After this PR these fields should exist; in older snapshots they won't.
  const required = [
    ["shot_type",        "PPTX § Level 1 — shot type capture per ball"],
    ["ball_line",        "PPTX § Level 1 — line per ball"],
    ["ball_length",      "PPTX § Level 1 — length per ball"],
    ["bowler_variant",   "PPTX § Level 1 — bowler variant per ball"],
    ["dismissal_zone",   "PPTX § Level 2 — dismissal zone"],
    ["ball_trajectory",  "PPTX § Level 2 — ball trajectory on wicket"],
    ["fielding_position", "PPTX § Level 2 — fielding position"],
    ["FieldingEntry",    "PPTX § 04 — per-innings fielding aggregates"],
    ["Partnership",      "PPTX § Team Analytics — partnership tracking"],
    ["powerplay_overs",  "PPTX § Match setup — powerplay range config"],
    ["win_probability",  "PPTX § Live Innings Tracking — win probability"],
    ["projected_score",  "PPTX § Live Innings Tracking — projected score"]
  ];
  for (const [field, hint] of required) {
    if (!schema.includes(field)) {
      add("P1", "feature", `Missing schema field: ${field}`, `scoring/backend/prisma/schema.prisma`, hint);
    }
  }

  const liveScoring = readSafe(join(ROOT, "scoring/frontend/src/pages/LiveScoring.tsx"));
  if (!liveScoring.includes("BALL_LENGTHS") || !liveScoring.includes("BALL_LINES")) {
    add("P1", "feature", "Live scoring UI missing PPTX Level 1 dropdowns",
        "scoring/frontend/src/pages/LiveScoring.tsx",
        "Wire ball length / ball line / bowler type / shot type into the ball-entry form.");
  }
  if (!liveScoring.includes("Undo") && !liveScoring.includes("undo")) {
    add("P2", "feature", "Undo last ball not exposed in scoring UI",
        "scoring/frontend/src/pages/LiveScoring.tsx",
        "Add an undo button (PPTX § Team — Edit score / Undo last ball).");
  }
  if (!existsSync(join(ROOT, "scoring/frontend/src/pages/InningsAnalytics.tsx"))) {
    add("P1", "feature", "Analytics view missing",
        "scoring/frontend/src/pages/InningsAnalytics.tsx",
        "PPTX § Scorecard & Analytics view — dismissal patterns + pitch map.");
  }
}

// ─── 2 · Security gaps ───────────────────────────────────────────────────────

function securityGaps() {
  // npm audit on backend
  for (const dir of ["backend", "frontend", "scoring/backend", "scoring/frontend"]) {
    const pkg = join(ROOT, dir, "package.json");
    if (!existsSync(pkg)) continue;
    try {
      const out = execSync("npm audit --json --omit=dev", { cwd: join(ROOT, dir), stdio: ["ignore", "pipe", "ignore"] }).toString();
      const data = JSON.parse(out);
      const high = data?.metadata?.vulnerabilities?.high ?? 0;
      const critical = data?.metadata?.vulnerabilities?.critical ?? 0;
      const moderate = data?.metadata?.vulnerabilities?.moderate ?? 0;
      if (critical > 0) add("P0", "security", `${critical} critical vulnerabilities in ${dir}`, `npm audit (omit=dev)`, "Run npm audit fix and review.");
      if (high > 0) add("P1", "security", `${high} high vulnerabilities in ${dir}`, `npm audit (omit=dev)`, "Run npm audit fix and review.");
      if (moderate > 0) add("P2", "security", `${moderate} moderate vulnerabilities in ${dir}`, `npm audit (omit=dev)`, "Track and patch.");
    } catch (e) {
      add("P3", "security", `npm audit failed for ${dir}`, e.message.slice(0, 120), "Run npm install first, then re-run audit.");
    }
  }

  // Secret-like patterns in tracked files (heuristic — false positives expected)
  const files = listFiles(ROOT, [".ts", ".tsx", ".js", ".mjs", ".json", ".yml", ".yaml", ".env.example", ".sh", ".md"]);
  const patterns = [
    [/AKIA[0-9A-Z]{16}/, "AWS access key"],
    [/AIza[0-9A-Za-z\-_]{35}/, "Google API key"],
    [/sk-[A-Za-z0-9]{20,}/, "OpenAI / similar secret key"],
    [/ghp_[A-Za-z0-9]{30,}/, "GitHub personal access token"],
    [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, "PEM private key"]
  ];
  for (const f of files) {
    if (f.includes(".env.example")) continue;
    if (f.includes("/docs/") || f.endsWith(".md")) continue;
    const t = readSafe(f);
    for (const [re, label] of patterns) {
      if (re.test(t)) {
        add("P0", "security", `Possible ${label} committed`,
            `${relative(ROOT, f)}`,
            "Rotate the credential immediately, scrub git history (git filter-repo), and add a .gitignore + pre-commit check.");
      }
    }
  }

  // Cors wildcard
  const corsHits = grep(/origin:\s*["']\*["']/g, listFiles(ROOT, [".ts", ".tsx", ".js"]));
  for (const f of corsHits) {
    add("P2", "security", "CORS wildcard origin",
        relative(ROOT, f),
        "Replace `*` with an explicit allowlist for production.");
  }

  // helmet missing
  const helmetMissing = !readSafe(join(ROOT, "backend/src/app.ts")).includes("helmet(");
  if (helmetMissing) {
    add("P1", "security", "Helmet not enabled on main backend",
        "backend/src/app.ts",
        "Add helmet() middleware to set security headers.");
  }

  // .env files tracked
  try {
    const tracked = execSync("git ls-files | grep -E '(^|/)\\.env$|(^|/)\\.env\\.(local|production|staging)$' || true", { cwd: ROOT }).toString().trim();
    if (tracked) {
      add("P0", "security", ".env files appear to be tracked in git",
          tracked,
          "Move secrets out of git, add to .gitignore, and use Secret Manager / GH Encrypted Secrets.");
    }
  } catch { /* ignore */ }
}

// ─── 3 · Production readiness gaps ───────────────────────────────────────────

function productionGaps() {
  const expected = {
    "backend": "main API",
    "scoring/backend": "scoring API"
  };
  for (const [dir, label] of Object.entries(expected)) {
    const app = readSafe(join(ROOT, dir, "src/app.ts"));
    if (app && !app.includes("/healthz")) {
      add("P1", "production", `${label} has no /healthz endpoint`, `${dir}/src/app.ts`, "Add a liveness probe for Cloud Run.");
    }
    if (app && !app.includes("/readyz") && dir === "backend") {
      add("P2", "production", `${label} has no /readyz endpoint`, `${dir}/src/app.ts`, "Add a readiness probe (db + dependency check).");
    }
  }

  // No pino / winston / structured logging in scoring backend
  const scoringApp = readSafe(join(ROOT, "scoring/backend/src/app.ts"));
  if (scoringApp && !/pino|winston|bunyan/.test(scoringApp)) {
    add("P1", "production", "Scoring backend lacks structured logging",
        "scoring/backend/src/app.ts",
        "Add pino-http (matches main backend) so Cloud Logging can parse fields.");
  }

  // No graceful shutdown
  const servers = ["backend/src/server.ts", "scoring/backend/src/server.ts"];
  for (const s of servers) {
    const txt = readSafe(join(ROOT, s));
    if (txt && !/SIGTERM|SIGINT/.test(txt)) {
      add("P2", "production", "No graceful shutdown handler",
          s, "Listen for SIGTERM and close the HTTP server + DB pool to drain in-flight requests cleanly.");
    }
  }

  // Rate limit missing on scoring
  if (!readSafe(join(ROOT, "scoring/backend/src/app.ts")).includes("rateLimit")) {
    add("P1", "production", "Scoring backend has no rate limiting",
        "scoring/backend/src/app.ts",
        "Add express-rate-limit (matches main backend's apiLimiter).");
  }

  // No CI config for scoring
  const ci = readSafe(join(ROOT, ".github/workflows/ci.yml"));
  if (ci && !/scoring/.test(ci)) {
    add("P2", "production", "CI does not exercise the scoring subproject",
        ".github/workflows/ci.yml",
        "Add a job that runs `cd scoring && npm ci && npm run build` so PRs catch scoring regressions.");
  }

  // No observability mention
  const observabilityHits = grep(/sentry|datadog|opentelemetry|otel/i,
    listFiles(ROOT, [".ts", ".tsx", ".js", ".yml", ".yaml", ".md"]));
  if (observabilityHits.length === 0) {
    add("P2", "production", "No APM / error tracking detected",
        "(repo-wide)",
        "Wire Sentry / OpenTelemetry. Cloud Logging gives logs, but you have no error groups or latency traces today.");
  }
}

// ─── 4 · Architecture gaps ───────────────────────────────────────────────────

function architectureGaps() {
  // Two backends, two prisma schemas — flag the divergence
  const main = existsSync(join(ROOT, "backend/prisma/schema.prisma"));
  const scoring = existsSync(join(ROOT, "scoring/backend/prisma/schema.prisma"));
  if (main && scoring) {
    add("P2", "architecture", "Two prisma schemas in the same repo",
        "backend/prisma/schema.prisma + scoring/backend/prisma/schema.prisma",
        "Document the boundary (which schema owns which models) or merge — duplicate User models risk drift.");
  }

  // README freshness
  try {
    const lastReadme = execSync("git log -1 --format=%ct README.md", { cwd: ROOT }).toString().trim();
    if (lastReadme) {
      const ageDays = (Date.now() / 1000 - Number(lastReadme)) / 86400;
      if (ageDays > 90) {
        add("P3", "architecture", "README is stale (>90 days)",
            `${ageDays.toFixed(0)}d since last edit`,
            "Refresh module list and quick-start steps.");
      }
    }
  } catch { /* ignore */ }

  // Architecture diagram present?
  const arch = readSafe(join(ROOT, "docs/ARCHITECTURE.md"));
  if (!arch.includes("```mermaid") && !arch.includes("![")) {
    add("P2", "architecture", "ARCHITECTURE.md has no diagrams",
        "docs/ARCHITECTURE.md",
        "Add at least one Mermaid C4 / context diagram so new engineers can orient.");
  }

  // Storybook / component catalogue?
  if (!existsSync(join(ROOT, ".storybook"))) {
    add("P3", "architecture", "No Storybook / component catalogue",
        "(repo-wide)",
        "Consider Storybook so the design system is discoverable. Optional for v1.");
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

featureGaps();
securityGaps();
productionGaps();
architectureGaps();

findings.sort((a, b) => sevWeight[b.sev] - sevWeight[a.sev]);

// Aggregate counts
const counts = findings.reduce((acc, f) => { acc[f.sev] = (acc[f.sev] || 0) + 1; return acc; }, {});

// ─── Write the report ────────────────────────────────────────────────────────

mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = join(REPORT_DIR, `${TODAY}.md`);

const header = `# Sportivox · Daily Gap Analysis — ${TODAY}

Generated by \`scripts/gap-analysis/gap-analysis.mjs\`.

| Severity | Count |
|---|---|
| P0 (critical) | ${counts.P0 ?? 0} |
| P1 (high) | ${counts.P1 ?? 0} |
| P2 (medium) | ${counts.P2 ?? 0} |
| P3 (low) | ${counts.P3 ?? 0} |
| **Total** | **${findings.length}** |

`;

let body = "## Findings\n\n";
if (findings.length === 0) {
  body += "_No gaps detected._\n";
} else {
  for (const f of findings) {
    body += `### [${f.sev}] ${f.area} · ${f.title}\n\n`;
    body += `**Evidence:** \`${f.evidence}\`\n\n`;
    body += `**Suggested action:** ${f.suggestion}\n\n---\n\n`;
  }
}

writeFileSync(reportPath, header + body);

// Also write a JSON summary for the workflow to surface in PR comments
writeFileSync(join(REPORT_DIR, `${TODAY}.json`), JSON.stringify({ date: TODAY, counts, findings }, null, 2));

// Symlink-ish "latest.md" copy
writeFileSync(join(REPORT_DIR, "latest.md"), header + body);

console.log(`✓ Wrote ${reportPath}`);
console.log(`  ${findings.length} findings (P0:${counts.P0 ?? 0} P1:${counts.P1 ?? 0} P2:${counts.P2 ?? 0} P3:${counts.P3 ?? 0})`);

// Non-zero exit if P0 findings exist so CI can flag them.
if ((counts.P0 ?? 0) > 0) process.exit(2);
