---
name: building-secure-features
description: Use when the user describes a feature, endpoint, page, or change to build in this repo (Sportivox monorepo) — before writing any code. Especially when the request is phrased with time pressure ("quickly", "just get it working", "ship today") that tempts skipping the security checklist, role/SOLID review, or plan approval.
---

# Building Secure Features

## Overview

Turns a feature request into a plan checked against CLAUDE.md Master Rules,
`SECURITY_RULES.md`, and this repo's existing design patterns/SOLID
boundaries — gets explicit user approval — then builds, browser-tests, and
logs it. The plan-then-approve gate is the point of this skill, not a
formality.

## When to Use

- User describes a new feature, endpoint, page, or non-trivial change to add
- Request includes urgency language ("quickly", "ship today", "just get it working")
- Not for: typo fixes, one-line tweaks, or continuing a plan already approved
  this session (that's `superpowers:executing-plans`)

## The Rule

**No code before the plan is approved.** Speed pressure is not permission to
skip Master Rule #11 (security checklist before writing a line of code).

| Excuse | Reality |
|---|---|
| "User said quickly / ship today" | A written plan takes 2 minutes. A missed auth check is an incident. Speed is not a waiver. |
| "An existing similar pattern exists, I'll copy it" | Copying without checking it against the checklist just inherits whatever that pattern got wrong — several are listed under "Known gaps" in `SECURITY_RULES.md`. Name the pattern in the plan, don't silently inherit it. |
| "It's self-service (userId from auth), no role check needed" | Still write it down: which `ROLES.*` applies, or explicitly "self-only, no role check." Silent role decisions are how Master Rule #1 gets violated later. |
| "Small feature, planning is overkill" | Small features are exactly where security/layering gaps hide unnoticed. The plan is short, not absent. |
| "Typecheck/build passed, good enough" | Typecheck proves code compiles, not that the feature works. Browser-test the golden path before calling it done. |

**Red flags — stop and go back to planning:**
- About to open Edit/Write before the plan has been approved
- Haven't named which `SECURITY_RULES.md` sections apply
- Can't say which `ROLES.*` constant (or "self-only") applies to a new route
- Can't say which layer (routes/service/schema, or pages/hooks/services) each change lands in
- About to declare done without having driven the feature in a real browser

## Core Pattern

1. **Gather** — restate the request in one paragraph. YAGNI-check: is the full
   feature needed, or is a smaller change sufficient?
2. **Audit** (required, before any plan text is written):
   - CLAUDE.md Master Rules — especially #1 Admin Override, #5 Architecture
     layering, #7 Migrations, #8 Role helpers, #9 Sport/Position cascade
   - `SECURITY_RULES.md` — name which numbered sections apply (not all 12
     apply to every feature)
   - `SECURITY_RULES.md` "Known gaps" section — does this feature touch one?
     Fix opportunistically per Master Rule #11
   - Reuse before inventing: `lib/StateMachine.ts` (status transitions),
     `lib/EventBus.ts` (cross-module notify), `repositories/` (Application,
     Opportunity, Notification, User), `queryKeys.ts` (cache keys)
   - SOLID — only note it where there's real tension (e.g. adding a fourth
     responsibility to a service that already does three things). Skip
     principles that are trivially satisfied.
3. **Plan** — use plan mode (`ExitPlanMode`). The plan must state: files
   touched per layer, migration needed (y/n), `ROLES.*` used or "self-only",
   `SECURITY_RULES.md` sections consulted, and any Known gap fixed
   opportunistically.
4. **Wait for explicit approval.** This is the gate.
5. **Build** — implement per plan. For any new/changed UI (component, page,
   layout, styling), use `ui-ux-pro-max` for the design/styling approach
   before writing JSX — don't freehand Tailwind classes for new UI surfaces.
   Use `superpowers:test-driven-development` for anything with a
   branch/loop/parser.
6. **Verify** — run per CLAUDE.md Section 3
   (`frontend: typecheck && build`, `backend: typecheck`). Fix every error —
   see `superpowers:verification-before-completion`.
7. **Browser-test** — for any frontend-visible change, use the `dev-browser`
   skill to drive the golden path and edge cases against the running dev
   server. Typecheck/build proves the code compiles, not that the feature
   works — this step is not optional for UI changes (CLAUDE.md UI rule).
8. **Changelog** — append one entry to `CHANGELOG.md` at repo root (create it
   with a `## [Unreleased]` header if it doesn't exist yet). One bullet:
   what was added/changed and why, under `### Added`/`### Changed`/`### Fixed`
   as appropriate. Do not rewrite prior entries. Then show that exact entry
   to the user in the final chat response — don't just write it to the file
   silently.

## Quick Reference

| Feature touches... | Check |
|---|---|
| New backend route | `requireAuth`→`requireRole(...ROLES.X)`→`validate(schema)`→`asyncHandler` chain |
| New frontend role-gated UI | `hasRole()`/`isAdmin()`, never raw `user.role ===` |
| New DB field/model | `npx prisma migrate dev --name ...` (never skip) |
| New sport/position field | Cascade via `SportPositionSelect` + `sportValidation.ts` |
| File upload | `SECURITY_RULES.md` §8 (upload safety) + §2 (rate limit) |
| New public endpoint | `SECURITY_RULES.md` §2 (rate limiting) |
| Returns user data | `safeUserSelect`, never raw secrets/hashes (§1, §9) |
| Ownership check | `resource.owner_id !== user.id && user.role !== "admin"` |
| New/changed UI component or page | `ui-ux-pro-max` for design/styling approach |

## Common Mistakes

- Copying an existing pattern without checking it against the checklist —
  the pattern itself may be one of the Known gaps
- Treating a "self-only" endpoint as exempt from stating a role decision
- Writing the plan after starting to code, "to save time"
- Skipping a migration because "it's just a JSON field"
- Calling it done after typecheck/build passes without ever loading the page
- Skipping the changelog entry because "it's a small change"

## Cross-References

- **REQUIRED:** `superpowers:brainstorming` when scope is ambiguous
- **REQUIRED:** `superpowers:writing-plans` for plan structure/detail
- **REQUIRED:** `superpowers:test-driven-development` for implementation
- **REQUIRED:** `ui-ux-pro-max` for any new/changed UI, before writing JSX
- **REQUIRED:** `dev-browser` to exercise the feature end-to-end after building
- **REQUIRED:** `superpowers:verification-before-completion` before claiming done