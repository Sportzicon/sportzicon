import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const updateProfileSchema = z
  .object({
    full_name: z.string().min(2).max(120).optional(),
    bio: z.string().max(500).optional(),
    profile_photo_url: z.string().url().optional(),
    cover_photo_url: z.string().url().optional(),
    country: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    dob: dateOnly.optional(),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
    preferred_language: z.string().max(20).optional(),
    phone: z.string().min(7).max(20).optional()
  })
  .strict();

export const athleteFieldsSchema = z
  .object({
    primary_sport: z.string().max(60).optional(),
    secondary_sports: z.array(z.string().max(60)).max(10).optional(),
    playing_role: z.string().max(60).optional(),
    position: z.string().max(60).optional(),
    style: z.string().max(120).optional(),
    dominance: z.string().max(20).optional(),
    height_cm: z.number().int().min(50).max(280).optional(),
    weight_kg: z.number().min(20).max(300).optional(),
    experience_level: z.enum(["beginner", "amateur", "semi_pro", "professional"]).optional(),
    current_team: z.string().max(120).optional(),
    previous_teams: z
      .array(z.object({ team: z.string().max(120), years: z.string().max(20) }))
      .max(20)
      .optional(),
    achievements: z
      .array(
        z.object({
          title: z.string().max(120),
          year: z.number().int().min(1900).max(2100),
          description: z.string().max(500).optional(),
          proof_url: z.string().url().optional()
        })
      )
      .max(50)
      .optional(),
    stats: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    cv_url: z.string().url().optional(),
    availability: z.enum(["available", "not_available", "open_to_offers"]).optional(),
    looking_for_club: z.boolean().optional()
  })
  .strict();

export const coachFieldsSchema = z
  .object({
    specialization: z.string().max(120).optional(),
    sport: z.string().max(60).optional(),
    experience_years: z.number().int().min(0).max(80).optional(),
    past_organizations: z.array(z.string().max(120)).max(20).optional(),
    certification_urls: z.array(z.string().url()).max(20).optional(),
    regions: z.array(z.string().max(120)).max(20).optional(),
    hiring_status: z.enum(["available", "not_available"]).optional()
  })
  .strict();

export const userIdParamSchema = z.object({ id: z.string().min(8) });
