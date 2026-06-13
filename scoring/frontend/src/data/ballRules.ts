// ── Client-side cricket-law rules for the live scoring console ────────────────
//
// Mirrors the authoritative backend engine (`backend/.../ballValidation.ts`).
// Used by LiveScoring to disable impossible inputs, prune the dismissal dropdown,
// and block submission of illegal deliveries with an inline reason. The backend
// still re-validates everything — this layer is purely for fast, clear UX.

export interface BallShape {
  batsman_id: string;
  bowler_id: string;
  non_striker_id: string;
  runs: number;
  is_wide: boolean;
  is_no_ball: boolean;
  is_bye: boolean;
  is_leg_bye: boolean;
  is_wicket: boolean;
  is_four: boolean;
  is_six: boolean;
  is_free_hit: boolean;
  wicket_type: string;
  dismissed_player_id: string;
  fielder_id: string;
  fielder_name: string;
}

// Ball-is-dead dismissals: no runs, no boundary off that delivery.
export const NO_RUNS_DISMISSALS = new Set(["bowled", "caught", "cb", "lbw", "stumped", "hit_wicket"]);
// Dismissals that need a named fielder (other than the bowler).
export const FIELDER_REQUIRED = new Set(["caught", "run_out", "stumped"]);
// Dismissals legal off a no-ball.
const NO_BALL_DISMISSALS = new Set(["run_out", "obstruction"]);
// Dismissals legal off a wide.
const WIDE_DISMISSALS = new Set(["run_out", "stumped", "hit_wicket", "obstruction"]);
// Dismissals legal off a free hit.
const FREE_HIT_DISMISSALS = new Set(["run_out", "obstruction"]);
// Dismissals that can only apply to the striker.
const STRIKER_ONLY_DISMISSALS = new Set(["bowled", "caught", "cb", "lbw", "stumped", "hit_wicket"]);

const WICKET_LABEL: Record<string, string> = {
  bowled: "Bowled", caught: "Caught", cb: "Caught & Bowled", lbw: "LBW",
  run_out: "Run out", stumped: "Stumped", hit_wicket: "Hit wicket", obstruction: "Obstruction"
};
const label = (w: string) => WICKET_LABEL[w] ?? w;

/**
 * Which dismissal types are selectable given the current delivery flags.
 * `retired_hurt` is always excluded — it is recorded via the Retire Hurt action,
 * not as a ball, so it never inflates the wicket tally.
 */
export function allowedWicketTypes(ball: BallShape, freeHitActive: boolean): Set<string> {
  let allowed: string[] = ["bowled", "caught", "cb", "lbw", "run_out", "stumped", "hit_wicket", "obstruction"];
  if (ball.is_no_ball) allowed = allowed.filter(w => NO_BALL_DISMISSALS.has(w));
  if (ball.is_wide) allowed = allowed.filter(w => WIDE_DISMISSALS.has(w));
  if (freeHitActive) allowed = allowed.filter(w => FREE_HIT_DISMISSALS.has(w));
  return new Set(allowed);
}

/** Whether runs/boundaries must be locked to zero for the current wicket selection. */
export function runsLockedToZero(ball: BallShape): boolean {
  return ball.is_wicket && NO_RUNS_DISMISSALS.has(ball.wicket_type);
}

/** Whether a four/six is selectable for the current delivery state. */
export function boundaryAllowed(ball: BallShape): boolean {
  if (ball.is_wide || ball.is_bye || ball.is_leg_bye) return false;
  if (ball.is_wicket && (NO_RUNS_DISMISSALS.has(ball.wicket_type) || ball.wicket_type === "run_out" || ball.wicket_type === "obstruction")) {
    return false;
  }
  return true;
}

/** Derive whether this delivery is a free hit from recent balls (most-recent first). */
export function deriveFreeHit(
  recentDescending: Array<{ is_no_ball?: boolean; is_wide?: boolean }>,
  freeHitEnabled: boolean
): boolean {
  if (!freeHitEnabled) return false;
  for (const b of recentDescending) {
    if (b.is_wide) continue;
    return !!b.is_no_ball;
  }
  return false;
}

/**
 * Full client-side validation. Returns human-readable violations (empty = legal).
 * Kept in lockstep with the backend so the two never disagree.
 */
export function validateBall(ball: BallShape, freeHitActive: boolean): string[] {
  const errors: string[] = [];
  const runs = Number(ball.runs ?? 0);

  if (!ball.batsman_id) errors.push("Select the striker.");
  if (!ball.bowler_id) errors.push("Select the bowler.");
  if (ball.non_striker_id && ball.non_striker_id === ball.batsman_id) {
    errors.push("Striker and non-striker cannot be the same player.");
  }

  if (ball.is_wide && ball.is_no_ball) errors.push("A ball can't be both a wide and a no-ball.");
  if (ball.is_bye && ball.is_leg_bye) errors.push("A ball can't be both a bye and a leg-bye.");
  if (ball.is_wide && (ball.is_bye || ball.is_leg_bye)) errors.push("Don't tick Bye with a wide — for a wide that runs to the boundary just tick Wide and tap 4 (scores as 5 wides).");

  if (ball.is_four && ball.is_six) errors.push("A ball can't be both a four and a six.");
  if (ball.is_four || ball.is_six) {
    if (ball.is_wide) errors.push("A boundary off the bat can't be a wide.");
    if (ball.is_bye || ball.is_leg_bye) errors.push("A boundary off the bat can't be a bye/leg-bye.");
    if (ball.is_four && runs !== 4) errors.push("'Four' set but runs is not 4.");
    if (ball.is_six && runs !== 6) errors.push("'Six' set but runs is not 6.");
  }

  if (ball.is_wicket) {
    if (!ball.wicket_type) errors.push("Choose a dismissal type.");
    if (ball.wicket_type === "retired_hurt") errors.push("Use the Retire Hurt action, not a wicket.");

    if (NO_RUNS_DISMISSALS.has(ball.wicket_type)) {
      if (runs !== 0) errors.push(`No runs can be scored when out ${label(ball.wicket_type)}.`);
      if (ball.is_four || ball.is_six) errors.push(`No boundary when out ${label(ball.wicket_type)}.`);
    }
    if ((ball.wicket_type === "run_out" || ball.wicket_type === "obstruction") && (ball.is_four || ball.is_six)) {
      errors.push("A boundary can't also be a run-out/obstruction.");
    }
    if (ball.is_no_ball && ball.wicket_type && !NO_BALL_DISMISSALS.has(ball.wicket_type)) {
      errors.push(`Off a no-ball only run-out/obstruction — not ${label(ball.wicket_type)}.`);
    }
    if (ball.is_wide && ball.wicket_type && !WIDE_DISMISSALS.has(ball.wicket_type)) {
      errors.push(`Off a wide only stumped/run-out/hit-wicket/obstruction — not ${label(ball.wicket_type)}.`);
    }
    if (freeHitActive && ball.wicket_type && !FREE_HIT_DISMISSALS.has(ball.wicket_type)) {
      errors.push(`On a free hit only run-out/obstruction — not ${label(ball.wicket_type)}.`);
    }
    const hasFielder = !!(ball.fielder_id || (ball.fielder_name && ball.fielder_name.trim()));
    if (FIELDER_REQUIRED.has(ball.wicket_type) && !hasFielder) {
      errors.push(`Name a fielder for the ${label(ball.wicket_type)}.`);
    }
    const dismissed = ball.dismissed_player_id || ball.batsman_id;
    if (STRIKER_ONLY_DISMISSALS.has(ball.wicket_type) && dismissed && dismissed !== ball.batsman_id) {
      errors.push(`Only the striker can be out ${label(ball.wicket_type)}.`);
    }
  }

  return errors;
}
