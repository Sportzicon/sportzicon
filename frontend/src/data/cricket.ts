// Cricket scoring vocab — mirrors PPTX § Batter & Bowler parameters.
// Single source for dropdowns shared across Level 1, Level 2 and scouting screens.

export const SHOT_TYPES = [
  { value: "defensive", label: "Defensive" },
  { value: "drive",     label: "Drive" },
  { value: "cut",       label: "Cut" },
  { value: "pull",      label: "Pull" },
  { value: "sweep",     label: "Sweep" },
  { value: "flick",     label: "Flick" },
  { value: "lofted",    label: "Lofted" },
  { value: "edge",      label: "Edge" },
  { value: "no_shot",   label: "No shot" }
] as const;

export const BALL_LINES = [
  { value: "outside_off_wide", label: "Outside off (wide)" },
  { value: "outside_off",      label: "Outside off" },
  { value: "off_stump",        label: "Off stump" },
  { value: "middle",           label: "Middle" },
  { value: "leg_stump",        label: "Leg stump" },
  { value: "outside_leg",      label: "Outside leg" },
  { value: "down_leg_wide",    label: "Down leg (wide)" }
] as const;

export const BALL_LENGTHS = [
  { value: "yorker",         label: "Yorker" },
  { value: "full",           label: "Full" },
  { value: "good_length",    label: "Good length" },
  { value: "back_of_length", label: "Back of length" },
  { value: "short",          label: "Short" },
  { value: "bouncer",        label: "Bouncer / Beamer" }
] as const;

export const BOWLER_VARIANTS = [
  { value: "rf",      label: "RF — Right-arm fast" },
  { value: "rfm",     label: "RFM — Right-arm fast-medium" },
  { value: "rmf",     label: "RMF — Right-arm medium-fast" },
  { value: "rm",      label: "RM — Right-arm medium" },
  { value: "lf",      label: "LF — Left-arm fast" },
  { value: "lfm",     label: "LFM — Left-arm fast-medium" },
  { value: "lm",      label: "LM — Left-arm medium" },
  { value: "ob",      label: "OB — Off-spin" },
  { value: "lb",      label: "LB — Leg-spin" },
  { value: "googly",  label: "Googly" },
  { value: "sla",     label: "SLA — LA Orthodox" },
  { value: "slw",     label: "SLW — Chinaman" },
  { value: "doosra",  label: "Doosra" },
  { value: "carrom",  label: "Carrom" },
  { value: "teesra",  label: "Teesra" }
] as const;

// Compact list used in Level 1 (PPTX § In-app · Bowler Type)
export const BOWLER_TYPE_SHORT = [
  { value: "ra_pace",   label: "RA Pace" },
  { value: "la_pace",   label: "LA Pace" },
  { value: "off_spin",  label: "Off spin" },
  { value: "leg_spin",  label: "Leg spin" },
  { value: "la_orth",   label: "LA Orth" },
  { value: "la_wrist",  label: "LA Wrist" }
] as const;

// Retired Hurt is NOT in WICKET_TYPES — it is not a dismissal.
// It is handled via a separate retireHurt API that does NOT increment the wicket count.
// Retired Out (deliberate, without consent) IS out and counts as a wicket.
export const WICKET_TYPES = [
  { value: "bowled",        label: "Bowled" },
  { value: "caught",        label: "Caught" },
  { value: "cb",            label: "Caught & Bowled" },
  { value: "lbw",           label: "LBW" },
  { value: "run_out",       label: "Run out" },
  { value: "stumped",       label: "Stumped" },
  { value: "hit_wicket",    label: "Hit wicket" },
  { value: "retired_out",   label: "Retired out (deliberate)" },
  { value: "obstruction",   label: "Obstruction / Other" }
] as const;

export const FIELDING_POSITIONS = [
  { value: "wk",          label: "WK" },
  { value: "slip_1",      label: "Slip 1st" },
  { value: "slip_2",      label: "Slip 2nd" },
  { value: "slip_3",      label: "Slip 3rd" },
  { value: "gully",       label: "Gully" },
  { value: "short_leg",   label: "Short leg" },
  { value: "leg_slip",    label: "Leg slip" },
  { value: "point",       label: "Point" },
  { value: "backward_point", label: "Backward point" },
  { value: "cover_point", label: "Cover point" },
  { value: "cover",       label: "Cover" },
  { value: "mid_off",     label: "Mid off" },
  { value: "mid_on",      label: "Mid on" },
  { value: "mid_wicket",  label: "Mid-wicket" },
  { value: "sq_leg",      label: "Square leg" },
  { value: "backward_sq_leg", label: "Backward sq leg" },
  { value: "fine_leg",    label: "Fine leg" },
  { value: "third_man",   label: "Third man" },
  { value: "long_off",    label: "Long off" },
  { value: "long_on",     label: "Long on" },
  { value: "deep_mw",     label: "Deep mid-wicket" },
  { value: "deep_cover",  label: "Deep cover" },
  { value: "deep_sq_leg", label: "Deep sq leg" },
  { value: "deep_fine_leg", label: "Deep fine leg" },
  { value: "deep_third_man", label: "Deep third man" },
  { value: "cow_corner",  label: "Cow corner" },
  { value: "other",       label: "Other" }
] as const;

export const DISMISSAL_ZONES = [
  { value: "off_side",       label: "Off side" },
  { value: "leg_side",       label: "Leg side" },
  { value: "straight",       label: "Straight" },
  { value: "behind_wicket",  label: "Behind wicket" }
] as const;

export const BALL_TRAJECTORIES = [
  { value: "edged_behind",  label: "Edged behind" },
  { value: "top_edge",      label: "Top edge" },
  { value: "leading_edge",  label: "Leading edge" },
  { value: "mishit",        label: "Mishit (aerial)" },
  { value: "beaten",        label: "Beaten off stump" },
  { value: "trapped",       label: "Trapped in front" },
  { value: "squeezed",      label: "Squeezed to fielder" }
] as const;

export const STRONG_ZONES = [
  { value: "cover",       label: "Cover" },
  { value: "straight",    label: "Straight" },
  { value: "mid_wicket",  label: "Mid-wicket" },
  { value: "square_leg",  label: "Square leg" },
  { value: "fine_leg",    label: "Fine leg" },
  { value: "all_around",  label: "All-around" }
] as const;

export const WEAK_ZONES = [
  { value: "outside_off", label: "Outside off" },
  { value: "short_ball",  label: "Short ball" },
  { value: "yorker",      label: "Yorker" },
  { value: "vs_spin",     label: "Against spin" },
  { value: "vs_la_pace",  label: "Against LA pace" }
] as const;

export const STRENGTH_VS = [
  { value: "pace",     label: "Pace" },
  { value: "spin",     label: "Spin" },
  { value: "la_pace",  label: "LA pace" },
  { value: "ra_pace",  label: "RA pace" },
  { value: "la_spin",  label: "LA spin" },
  { value: "leg_spin", label: "Leg spin" }
] as const;

export const PREFERRED_ZONES = [
  { value: "off_side",  label: "Off side" },
  { value: "leg_side",  label: "Leg side" },
  { value: "straight",  label: "Straight" },
  { value: "360",       label: "360°" }
] as const;

export const BALL_TYPES = [
  { value: "red",   label: "Red" },
  { value: "white", label: "White" },
  { value: "pink",  label: "Pink" }
] as const;

export const FIELDING_EVENTS = [
  { value: "catch",            label: "Catch" },
  { value: "drop",             label: "Drop" },
  { value: "run_out_assist",   label: "Run-out (assist)" },
  { value: "direct_hit",       label: "Direct hit" },
  { value: "stumping",         label: "Stumping" },
  { value: "misfield",         label: "Misfield" },
  { value: "assist",           label: "Assist / relay" }
] as const;

// Used to compute Level 1 → bowler_variant default if only short type chosen.
export function bowlerVariantFromShort(short: string | undefined): string | undefined {
  switch (short) {
    case "ra_pace":  return "rfm";
    case "la_pace":  return "lfm";
    case "off_spin": return "ob";
    case "leg_spin": return "lb";
    case "la_orth":  return "sla";
    case "la_wrist": return "slw";
    default:         return undefined;
  }
}
