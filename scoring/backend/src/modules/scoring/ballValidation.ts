// ── Ball-by-ball cricket-law validation ──────────────────────────────────────
//
// Authoritative enforcement of which delivery permutations are legal under the
// Laws of Cricket. `addBall` runs this BEFORE any database write, so an illegal
// combination (e.g. "bowled + six", "wide + caught", dismissing the non-striker
// bowled) is rejected with a clear message and nothing is persisted.
//
// The frontend mirrors a subset of these rules in `data/ballRules.ts` to disable
// impossible inputs live — but this module is the source of truth. Never trust
// the client.

export interface BallInputLike {
  batsman_id?: string | null;
  bowler_id?: string | null;
  non_striker_id?: string | null;
  runs?: number;
  is_wide?: boolean;
  is_no_ball?: boolean;
  is_bye?: boolean;
  is_leg_bye?: boolean;
  is_penalty?: boolean;
  is_wicket?: boolean;
  is_four?: boolean;
  is_six?: boolean;
  is_free_hit?: boolean;
  wicket_type?: string | null;
  dismissed_player_id?: string | null;
  fielder_id?: string | null;
  fielder_name?: string | null;
}

export interface BallContext {
  /** This delivery is a free hit (derived from the previous no-ball + tournament setting). */
  freeHitActive: boolean;
  /** Wickets already fallen in this innings. */
  wicketsSoFar: number;
  /** Maximum wickets the innings can lose before it is all out (squad size − 1, capped at 10). */
  maxWickets: number;
}

// Known dismissal vocabulary (mirrors WICKET_TYPES on the frontend).
export const WICKET_TYPES = [
  "bowled", "caught", "cb", "lbw", "run_out",
  "stumped", "hit_wicket", "retired_hurt", "obstruction"
] as const;
export type WicketType = (typeof WICKET_TYPES)[number];

// Dismissals where the ball is dead the instant it happens, so the batsman
// cannot have scored runs and the ball cannot be a boundary.
const NO_RUNS_DISMISSALS = new Set<string>(["bowled", "caught", "cb", "lbw", "stumped", "hit_wicket"]);

// Dismissals credited to the bowler.
export const BOWLER_CREDIT_DISMISSALS = new Set<string>(["bowled", "caught", "cb", "lbw", "stumped", "hit_wicket"]);

// Dismissals that require a fielder (other than the bowler) to be named.
const FIELDER_REQUIRED = new Set<string>(["caught", "run_out", "stumped"]);

// Off a no-ball, only these dismissals are possible.
const NO_BALL_DISMISSALS = new Set<string>(["run_out", "obstruction"]);

// Off a wide, only these dismissals are possible.
const WIDE_DISMISSALS = new Set<string>(["run_out", "stumped", "hit_wicket", "obstruction"]);

// Off a free hit, a batsman can only be dismissed by these means.
const FREE_HIT_DISMISSALS = new Set<string>(["run_out", "obstruction"]);

// Dismissals that can only ever apply to the striker (the batsman on strike).
const STRIKER_ONLY_DISMISSALS = new Set<string>(["bowled", "caught", "cb", "lbw", "stumped", "hit_wicket"]);

const WICKET_LABEL: Record<string, string> = {
  bowled: "Bowled", caught: "Caught", cb: "Caught & Bowled", lbw: "LBW",
  run_out: "Run out", stumped: "Stumped", hit_wicket: "Hit wicket",
  retired_hurt: "Retired hurt", obstruction: "Obstruction"
};
const label = (w?: string | null) => WICKET_LABEL[w ?? ""] ?? (w ?? "this dismissal");

/**
 * Validate a single delivery against the Laws of Cricket.
 * Returns a list of human-readable violation messages (empty = legal).
 */
export function validateBall(input: BallInputLike, ctx: BallContext): string[] {
  const errors: string[] = [];

  const runs = Number(input.runs ?? 0);
  const isWide = !!input.is_wide;
  const isNoBall = !!input.is_no_ball;
  const isBye = !!input.is_bye;
  const isLegBye = !!input.is_leg_bye;
  const isWicket = !!input.is_wicket;
  const isFour = !!input.is_four;
  const isSix = !!input.is_six;
  const wicketType = input.wicket_type ?? "";

  // ── R1: players ────────────────────────────────────────────────────────────
  if (!input.batsman_id) errors.push("Striker (batsman) is required.");
  if (!input.bowler_id) errors.push("Bowler is required.");
  if (input.non_striker_id && input.non_striker_id === input.batsman_id) {
    errors.push("Striker and non-striker cannot be the same player.");
  }
  if (input.bowler_id && (input.bowler_id === input.batsman_id || input.bowler_id === input.non_striker_id)) {
    errors.push("Bowler cannot also be a batsman at the crease.");
  }

  // ── R2: runs sanity ──────────────────────────────────────────────────────
  if (!Number.isInteger(runs) || runs < 0 || runs > 7) {
    errors.push("Runs must be a whole number between 0 and 7.");
  }

  // ── R3: mutually exclusive extras ────────────────────────────────────────
  if (isWide && isNoBall) {
    errors.push("A delivery cannot be both a wide and a no-ball.");
  }
  if (isBye && isLegBye) {
    errors.push("A delivery cannot be both a bye and a leg-bye.");
  }
  if (isWide && (isBye || isLegBye)) {
    errors.push("Don't combine byes/leg-byes with a wide. If a wide beats the keeper and runs to the boundary, just tick Wide and enter the runs (e.g. 4) — it scores as 5 wides.");
  }

  // ── R4: boundary flags ───────────────────────────────────────────────────
  if (isFour && isSix) {
    errors.push("A delivery cannot be both a four and a six.");
  }
  if (isFour || isSix) {
    if (isWide) errors.push("A four/six off the bat cannot be a wide — runs to the boundary off a wide are scored as wides.");
    if (isBye || isLegBye) errors.push("A four/six off the bat cannot be a bye/leg-bye — those runs are not scored off the bat.");
    if (isFour && runs !== 4) errors.push("'Four' is set but runs off the bat is not 4.");
    if (isSix && runs !== 6) errors.push("'Six' is set but runs off the bat is not 6.");
  }

  // ── R5: wicket basics ────────────────────────────────────────────────────
  if (isWicket) {
    if (!wicketType) {
      errors.push("Select a dismissal type for the wicket.");
    } else if (!WICKET_TYPES.includes(wicketType as WicketType)) {
      errors.push(`Unknown dismissal type: ${wicketType}.`);
    }

    // R5a: retired hurt is not a dismissal and must not be entered as a ball.
    if (wicketType === "retired_hurt") {
      errors.push("Retired hurt is not a dismissal — use the Retire Hurt action so the wicket tally stays correct.");
    }

    // R6: a ball-is-dead dismissal means no runs and no boundary off that ball.
    if (NO_RUNS_DISMISSALS.has(wicketType)) {
      if (runs !== 0) errors.push(`No runs can be scored when the batsman is out ${label(wicketType)}.`);
      if (isFour || isSix) errors.push(`A boundary is impossible when the batsman is out ${label(wicketType)}.`);
    }
    // A run-out/obstruction can have completed runs, but never a boundary
    // (a ball that reaches the rope is dead — nobody can be run out off it).
    if ((wicketType === "run_out" || wicketType === "obstruction") && (isFour || isSix)) {
      errors.push(`A boundary cannot also be a ${label(wicketType)} — the ball is dead at the rope.`);
    }

    // R7: dismissal legality on illegal deliveries.
    if (isNoBall && wicketType && !NO_BALL_DISMISSALS.has(wicketType)) {
      errors.push(`Off a no-ball the batsman can only be run out or out obstructing — not ${label(wicketType)}.`);
    }
    if (isWide && wicketType && !WIDE_DISMISSALS.has(wicketType)) {
      errors.push(`Off a wide the batsman can only be stumped, run out, hit wicket or obstructing — not ${label(wicketType)}.`);
    }

    // R8: free hit — only run-out / obstruction.
    if (ctx.freeHitActive && wicketType && !FREE_HIT_DISMISSALS.has(wicketType)) {
      errors.push(`On a free hit the batsman can only be run out or out obstructing — not ${label(wicketType)}.`);
    }

    // R9: fielder requirement.
    const hasFielder = !!(input.fielder_id || (input.fielder_name && input.fielder_name.trim()));
    if (FIELDER_REQUIRED.has(wicketType) && !hasFielder) {
      errors.push(`A fielder must be named for a ${label(wicketType)}.`);
    }

    // R10: dismissed-player identity.
    const dismissed = input.dismissed_player_id || input.batsman_id;
    const atCrease = [input.batsman_id, input.non_striker_id].filter(Boolean);
    if (dismissed && atCrease.length && !atCrease.includes(dismissed)) {
      errors.push("The dismissed player must be one of the two batsmen at the crease.");
    }
    if (STRIKER_ONLY_DISMISSALS.has(wicketType) && dismissed && dismissed !== input.batsman_id) {
      errors.push(`Only the striker can be out ${label(wicketType)} — the non-striker cannot.`);
    }
  }

  // ── R11: innings limits ──────────────────────────────────────────────────
  if (ctx.wicketsSoFar >= ctx.maxWickets) {
    errors.push("The batting side is already all out — start the next innings instead of recording another ball.");
  } else if (isWicket && ctx.wicketsSoFar + 1 > ctx.maxWickets) {
    errors.push("This wicket would exceed the all-out limit for the innings.");
  }

  return errors;
}

/**
 * Determine whether the next delivery is a free hit, given the recent ball
 * history (most-recent first) and the tournament's free-hit setting.
 *
 * A free hit follows a no-ball and persists through any wides bowled before the
 * next legal delivery is faced.
 */
export function deriveFreeHit(
  recentBallsDescending: Array<{ is_no_ball: boolean; is_wide: boolean }>,
  freeHitEnabled: boolean
): boolean {
  if (!freeHitEnabled) return false;
  for (const b of recentBallsDescending) {
    if (b.is_wide) continue;        // wides don't consume the free hit
    return !!b.is_no_ball;          // first non-wide ball decides it
  }
  return false;
}
