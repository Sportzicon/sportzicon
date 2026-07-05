import { z } from "zod";
import { VALID_SPORTS, isValidSportPosition } from "../../utils/sportValidation";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

function sportPositionSuperRefine(
  data: { sport?: string; position?: string },
  ctx: z.RefinementCtx
) {
  if (data.sport && !data.position) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Position is required when sport is provided",
      path: ["position"],
    });
  }
  if (data.sport && data.position && !isValidSportPosition(data.sport, data.position)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `"${data.position}" is not a valid position for ${data.sport}`,
      path: ["position"],
    });
  }
}

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(2).max(100).trim().optional(),
    bio: z.string().max(200).optional(),
    location: z.string().max(100).optional(),
    avatar_url: z.union([z.string().url(), z.literal("")]).optional(),
    profile_photo_url: z.union([z.string().url(), z.null()]).optional(),
    cover_photo_url: z.union([z.string().url(), z.null()]).optional(),
    country: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    dob: dateOnly.optional(),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
    preferred_language: z.string().max(20).optional(),
    phone: z.string().min(7).max(20).optional(),
    sport: z
      .string()
      .refine((s) => VALID_SPORTS.includes(s), { message: "Invalid sport" })
      .optional(),
    position: z.string().optional(),
  })
  .superRefine(sportPositionSuperRefine);

// Validate that a date string is between minYears and maxYears ago from today.
function yearsAgoRange(minYears: number, maxYears: number) {
  return (val: string) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const minDate = new Date(now.getFullYear() - maxYears, now.getMonth(), now.getDate());
    const maxDate = new Date(now.getFullYear() - minYears, now.getMonth(), now.getDate());
    return d >= minDate && d <= maxDate;
  };
}

export const athleteFieldsSchema = z
  .object({
    primary_sport: z
      .string()
      .refine((s) => VALID_SPORTS.includes(s), { message: "Invalid sport" })
      .optional(),
    position: z.string().optional(),
    secondary_sports: z.array(z.string().max(60)).max(10).optional(),
    playing_role: z.string().max(60).optional(),
    style: z.string().max(120).optional(),
    batting_style: z.string().max(60).optional(),
    bowling_style: z.string().max(120).optional(),
    dominance: z.string().max(20).optional(),
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .refine(yearsAgoRange(5, 60), "Date of birth must be 5–60 years ago")
      .optional(),
    height_cm: z.number().int().min(100).max(250).optional(),
    weight_kg: z.number().int().min(30).max(200).optional(),
    experience_level: z.enum(["beginner", "amateur", "semi_pro", "professional"]).optional(),
    experience_years: z.number().int().min(0).max(50).optional(),
    current_team: z.string().max(120).optional(),
    previous_teams: z
      .array(z.object({ team: z.string().max(120), years: z.string().max(20) }))
      .max(20)
      .optional(),
    career_history: z
      .array(
        z.object({
          club: z.string().max(120),
          from: z.string().max(20).optional(),
          to: z.string().max(20).nullable().optional(),
          current: z.boolean().optional(),
        })
      )
      .max(20)
      .optional(),
    achievements: z.array(z.string().max(200)).max(20).optional(),
    stats: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    cv_url: z.string().url().optional(),
    career_summary: z.string().max(1000).optional(),
    availability: z.enum(["available", "not_available", "open_to_offers"]).optional(),
    looking_for_club: z.boolean().optional(),
    scorecard_links: z
      .array(
        z.object({
          url: z.string().url().max(500),
          label: z.string().max(120).optional(),
          source: z.string().max(120).optional(),
          preview_title: z.string().max(300).optional(),
          preview_image: z.string().url().max(500).optional(),
        })
      )
      .max(15)
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Use primary_sport / position for cascade validation in athlete schema
    sportPositionSuperRefine(
      { sport: data.primary_sport, position: data.position },
      ctx
    );
  });

export const coachFieldsSchema = z
  .object({
    specialization: z.string().max(120).optional(),
    sport: z.string().max(60).optional(),
    experience_years: z.number().int().min(0).max(80).optional(),
    past_organizations: z.array(z.string().max(120)).max(20).optional(),
    certification_urls: z.array(z.string().url()).max(20).optional(),
    regions: z.array(z.string().max(120)).max(20).optional(),
    hiring_status: z.enum(["available", "not_available"]).optional(),
  })
  .strict();

export const userIdParamSchema = z.object({ id: z.string().min(8) });

export const linkPreviewRequestSchema = z.object({
  url: z.string().url().max(500),
});

export const DOCUMENT_TYPES = [
  "Sports CV",
  "Government ID",
  "Coach Endorsement",
  "Medical Certificate",
  "Fitness Report",
  "Training Certificate",
  "Reference Letter",
  "Academic Transcript",
  "Age Proof",
  "NOC from Current Club",
  "Passport Copy",
  "Other",
] as const;

export const uploadDocumentBodySchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
});

export const documentParamSchema = z.object({
  id: z.string().min(8),
  docId: z.string().min(8),
});

export const tournamentParamSchema = z.object({
  id: z.string().min(8),
  tournamentId: z.string().min(8),
});

export const tournamentSchema = z.object({
  name: z.string().min(1).max(200),
  year: z.string().max(4),
  team: z.string().max(120).optional(),
  format: z.string().max(60).optional(),
  result: z.string().max(200).optional(),
});
