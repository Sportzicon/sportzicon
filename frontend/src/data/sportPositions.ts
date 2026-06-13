// ── Sport / position catalogue (client mirror) ───────────────────────────────
//
// Mirror of `backend/src/utils/sportValidation.ts`. Drives SportPositionSelect
// and any sport/position form pair. The backend re-validates every submission —
// this layer exists purely for fast, clear UX.

export const SPORT_POSITIONS: Record<string, string[]> = {
  cricket: [
    "Right-hand Batsman", "Left-hand Batsman",
    "Right-arm Fast Bowler", "Left-arm Fast Bowler",
    "Right-arm Medium Bowler", "Left-arm Medium Bowler",
    "Right-arm Off Spinner", "Left-arm Orthodox Spinner",
    "Right-arm Leg Spinner", "Left-arm Unorthodox Spinner",
    "Wicket-keeper Batsman", "Batting All-rounder", "Bowling All-rounder",
  ],
  football: [
    "Goalkeeper", "Centre-back", "Right-back", "Left-back",
    "Defensive Midfielder", "Central Midfielder", "Attacking Midfielder",
    "Right Winger", "Left Winger", "Centre Forward", "Striker",
  ],
  basketball: [
    "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center",
  ],
  swimming: [
    "Freestyle", "Backstroke", "Breaststroke", "Butterfly",
    "Individual Medley", "Open Water",
  ],
  athletics: [
    "100m", "200m", "400m", "800m", "1500m", "5000m", "10000m", "Marathon",
    "110m Hurdles", "400m Hurdles", "High Jump", "Long Jump", "Triple Jump",
    "Pole Vault", "Shot Put", "Discus", "Javelin", "Hammer", "Decathlon", "Heptathlon",
  ],
  hockey: [
    "Goalkeeper", "Defender", "Right Midfielder", "Left Midfielder",
    "Centre Midfielder", "Forward", "Right Wing", "Left Wing",
  ],
  tennis: ["Singles", "Doubles", "Mixed Doubles"],
  badminton: ["Singles", "Doubles", "Mixed Doubles"],
  volleyball: ["Setter", "Outside Hitter", "Opposite Hitter", "Middle Blocker", "Libero"],
  kabaddi: ["Raider", "Defender", "All-rounder"],
  wrestling: ["Freestyle", "Greco-Roman"],
  boxing: [
    "Flyweight", "Bantamweight", "Featherweight", "Lightweight", "Welterweight",
    "Middleweight", "Light Heavyweight", "Heavyweight",
  ],
  other: ["Not Applicable"],
};

/** Title-cased options for a `<select>` of sports (value is the lowercase key). */
export const SPORTS_LIST: { value: string; label: string }[] = Object.keys(SPORT_POSITIONS).map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

/** Positions registered for a sport (empty array for unknown / unset sports). */
export function getPositions(sport: string | null | undefined): string[] {
  if (!sport) return [];
  return SPORT_POSITIONS[sport] ?? [];
}

/** True when `position` is one of the positions registered for `sport`. */
export function isValidPosition(sport: string, position: string): boolean {
  const positions = SPORT_POSITIONS[sport];
  if (!positions) return false;
  return positions.includes(position);
}
