// ── Authoritative sport / position catalogue ─────────────────────────────────
//
// Single backend source of truth for which positions belong to which sport.
// Mirrored on the client at `frontend/src/data/sportPositions.ts`. The backend
// always re-validates submitted sport/position pairs via isValidSportPosition().

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

export const VALID_SPORTS: string[] = Object.keys(SPORT_POSITIONS);

/** True when `position` is one of the positions registered for `sport`. */
export function isValidSportPosition(sport: string, position: string): boolean {
  const positions = SPORT_POSITIONS[sport];
  if (!positions) return false;
  return positions.includes(position);
}
