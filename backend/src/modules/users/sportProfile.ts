// ── Sport-profile validation (authoritative) ─────────────────────────────────
//
// A sport-specific attribute must belong to the athlete's sport. A footballer
// can't have a bowling style; a swimmer can't have a batting style. This module
// is the single source of truth — it validates the FINAL merged athlete object
// (existing data + incoming patch), so a partial update that flips the sport
// without clearing the now-invalid attributes is still caught.
//
// The frontend mirrors these rules in `frontend/src/data/sportProfile.ts` for
// live UX, but never trust the client.

// Canonical playing roles per sport (lowercased sport key).
export const SPORT_ROLES: Record<string, string[]> = {
  cricket: ["Batter", "Bowler", "All-rounder", "Wicket-keeper"],
  football: ["Goalkeeper", "Defender", "Midfielder", "Winger", "Striker"],
  basketball: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Centre"],
  hockey: ["Goalkeeper", "Defender", "Midfielder", "Forward"],
  kabaddi: ["Raider", "Defender", "All-rounder"],
  tennis: ["Singles specialist", "Doubles specialist", "All-court"],
  badminton: ["Singles specialist", "Doubles specialist", "All-court"],
  athletics: ["Sprinter", "Middle distance", "Long distance", "Jumper", "Thrower", "Multi-event"]
};

// Cricket batting hand.
export const CRICKET_BATTING_STYLES = ["Right-hand bat", "Left-hand bat"];

// Cricket bowling actions.
export const CRICKET_BOWLING_STYLES = [
  "Right-arm fast", "Right-arm fast-medium", "Right-arm medium",
  "Right-arm off-break", "Right-arm leg-break",
  "Left-arm fast", "Left-arm fast-medium", "Left-arm orthodox", "Left-arm chinaman",
  "Does not bowl"
];

// Tennis / Badminton reuse `batting_style` to store racquet hand.
export const RACQUET_HANDS = ["Right-handed", "Left-handed", "Ambidextrous"];

// Sports where a playing position/role is not meaningful.
export const SPORTS_WITHOUT_POSITION = ["swimming", "gymnastics", "crossfit", "cycling", "rowing", "skiing", "boxing", "wrestling"];

export function sportSupportsBatting(sport: string): boolean {
  const s = sport.toLowerCase();
  return s === "cricket" || s === "tennis" || s === "badminton";
}
export function sportSupportsBowling(sport: string): boolean {
  return sport.toLowerCase() === "cricket";
}
export function sportRequiresPosition(sport: string): boolean {
  return !!sport && !SPORTS_WITHOUT_POSITION.includes(sport.toLowerCase());
}

// Allowed values for the (overloaded) batting_style field, by sport.
function allowedBattingValues(sport: string): string[] | null {
  const s = sport.toLowerCase();
  if (s === "cricket") return CRICKET_BATTING_STYLES;
  if (s === "tennis" || s === "badminton") return RACQUET_HANDS;
  return null; // sport doesn't use batting_style at all
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Validate the merged athlete profile. Returns human-readable violations
 * (empty = valid). Only fields that are present are checked, except where a
 * field is meaningless for the chosen sport.
 */
export function validateAthleteSportProfile(athlete: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const sport = str(athlete.primary_sport);
  const battingStyle = str(athlete.batting_style);
  const bowlingStyle = str(athlete.bowling_style);
  const role = str(athlete.playing_role) || str(athlete.position);

  // Without a sport we can't judge sport-specific attributes — but a stray
  // cricket attribute with no sport at all is still nonsensical.
  if (!sport) {
    if (battingStyle) errors.push("Set your primary sport before choosing a batting style / preferred hand.");
    if (bowlingStyle) errors.push("Set your primary sport before choosing a bowling style.");
    return errors;
  }

  const sportLower = sport.toLowerCase();

  // Bowling style is cricket-only.
  if (bowlingStyle) {
    if (!sportSupportsBowling(sport)) {
      errors.push(`Bowling style only applies to cricket — remove it for ${sport}.`);
    } else if (!CRICKET_BOWLING_STYLES.includes(bowlingStyle)) {
      errors.push(`"${bowlingStyle}" is not a valid cricket bowling style.`);
    }
  }

  // Batting style / preferred hand: only some sports, with sport-specific values.
  if (battingStyle) {
    const allowed = allowedBattingValues(sport);
    if (!allowed) {
      errors.push(`Batting style / preferred hand doesn't apply to ${sport}.`);
    } else if (!allowed.includes(battingStyle)) {
      const labelField = sportLower === "cricket" ? "batting style" : "preferred hand";
      errors.push(`"${battingStyle}" is not a valid ${labelField} for ${sport}.`);
    }
  }

  // Playing role: sports without positions (swimming, gymnastics, …) must not
  // carry a role. We deliberately do NOT enforce exact role membership here —
  // the profile editor allows descriptive free-text positions ("Opener",
  // "Fast bowler"). The controlled signup dropdown enforces membership client-side.
  if (role && !sportRequiresPosition(sport)) {
    errors.push(`${sport} has no playing position — remove the role "${role}".`);
  }

  return errors;
}

/**
 * Strip attributes that don't belong to the given sport. Used by the service
 * layer so a sport change can be auto-cleaned rather than rejected outright
 * (callers may prefer to clean instead of erroring).
 */
export function stripInvalidSportFields<T extends Record<string, unknown>>(athlete: T): T {
  const a = { ...athlete };
  const sport = str(a.primary_sport);
  if (!sportSupportsBowling(sport)) delete (a as any).bowling_style;
  if (!allowedBattingValues(sport)) delete (a as any).batting_style;
  if (sport && !sportRequiresPosition(sport)) {
    delete (a as any).position;
    delete (a as any).playing_role;
  }
  return a;
}
