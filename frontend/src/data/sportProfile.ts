// ── Sport-profile rules for the client ───────────────────────────────────────
//
// Mirrors the authoritative backend engine (`backend/src/modules/users/sportProfile.ts`).
// Drives the signup/edit forms: which playing roles a sport offers, which
// sport-specific attribute fields to show, and clearing stale attributes when
// the sport changes (so a footballer can't keep a cricket bowling style). The
// backend re-validates everything — this layer is purely for fast, clear UX.

export const SPORTS = ["Cricket", "Football", "Athletics", "Basketball", "Hockey", "Tennis", "Badminton", "Kabaddi"];

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

export const CRICKET_BATTING_STYLES = ["Right-hand bat", "Left-hand bat"];
export const CRICKET_BOWLING_STYLES = [
  "Right-arm fast", "Right-arm fast-medium", "Right-arm medium",
  "Right-arm off-break", "Right-arm leg-break",
  "Left-arm fast", "Left-arm fast-medium", "Left-arm orthodox", "Left-arm chinaman",
  "Does not bowl"
];
export const RACQUET_HANDS = ["Right-handed", "Left-handed", "Ambidextrous"];

export const SPORTS_WITHOUT_POSITION = ["swimming", "gymnastics", "crossfit", "cycling", "rowing", "skiing", "boxing", "wrestling"];

/** Playing roles offered for a sport (falls back to a generic set for unknown sports). */
export function rolesForSport(sport: string): string[] {
  return SPORT_ROLES[sport?.toLowerCase()] ?? ["Attacker", "Defender", "All-rounder", "Other"];
}

export function sportSupportsBatting(sport: string): boolean {
  const s = sport?.toLowerCase() ?? "";
  return s === "cricket" || s === "tennis" || s === "badminton";
}
export function sportSupportsBowling(sport: string): boolean {
  return sport?.toLowerCase() === "cricket";
}
export function sportUsesRacquetHand(sport: string): boolean {
  const s = sport?.toLowerCase() ?? "";
  return s === "tennis" || s === "badminton";
}
export function sportRequiresPosition(sport: string): boolean {
  return !!sport && !SPORTS_WITHOUT_POSITION.includes(sport.toLowerCase());
}

function allowedBattingValues(sport: string): string[] | null {
  const s = sport?.toLowerCase() ?? "";
  if (s === "cricket") return CRICKET_BATTING_STYLES;
  if (s === "tennis" || s === "badminton") return RACQUET_HANDS;
  return null;
}

export interface AthleteSportFields {
  primary_sport?: string;
  position?: string;
  playing_role?: string;
  batting_style?: string;
  bowling_style?: string;
}

/**
 * Return a copy with sport-specific attributes that no longer apply removed.
 * Call this whenever the user changes `primary_sport` so stale values from the
 * previous sport (e.g. a cricket bowling style) don't get submitted.
 */
export function clearSportSpecific<T extends AthleteSportFields>(athlete: T): T {
  const a = { ...athlete };
  const sport = a.primary_sport ?? "";
  if (!sportSupportsBowling(sport)) a.bowling_style = "";
  const battingAllowed = allowedBattingValues(sport);
  if (!battingAllowed || (a.batting_style && !battingAllowed.includes(a.batting_style))) {
    a.batting_style = "";
  }
  return a;
}

/** Client-side validation; mirrors the backend. Returns violations (empty = valid). */
export function validateAthleteSportProfile(athlete: AthleteSportFields): string[] {
  const errors: string[] = [];
  const sport = (athlete.primary_sport ?? "").trim();
  const battingStyle = (athlete.batting_style ?? "").trim();
  const bowlingStyle = (athlete.bowling_style ?? "").trim();
  const role = (athlete.playing_role ?? athlete.position ?? "").trim();

  if (!sport) {
    if (battingStyle) errors.push("Set your primary sport before choosing a batting style / preferred hand.");
    if (bowlingStyle) errors.push("Set your primary sport before choosing a bowling style.");
    return errors;
  }

  if (bowlingStyle) {
    if (!sportSupportsBowling(sport)) errors.push(`Bowling style only applies to cricket — remove it for ${sport}.`);
    else if (!CRICKET_BOWLING_STYLES.includes(bowlingStyle)) errors.push(`"${bowlingStyle}" is not a valid cricket bowling style.`);
  }

  if (battingStyle) {
    const allowed = allowedBattingValues(sport);
    if (!allowed) errors.push(`Batting style / preferred hand doesn't apply to ${sport}.`);
    else if (!allowed.includes(battingStyle)) {
      const labelField = sport.toLowerCase() === "cricket" ? "batting style" : "preferred hand";
      errors.push(`"${battingStyle}" is not a valid ${labelField} for ${sport}.`);
    }
  }

  if (role && !sportRequiresPosition(sport)) {
    errors.push(`${sport} has no playing position — remove the role "${role}".`);
  }

  return errors;
}
