export const ROLES = {
  ALL:                ["athlete","club","scout","organizer","scorer","admin"],
  CONTENT_CREATORS:   ["athlete","club","organizer","admin"],
  RECRUITERS:         ["club","scout","organizer","admin"],
  CLUB_MANAGERS:      ["club","organizer","admin"],
  SCORERS:            ["scorer","admin"],
  ATHLETES_AND_ADMIN: ["athlete","admin"],
} as const;
