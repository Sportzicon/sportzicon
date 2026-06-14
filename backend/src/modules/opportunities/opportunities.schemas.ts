import { z } from "zod";
import { VALID_SPORTS } from "../../utils/sportValidation";

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use ISO date YYYY-MM-DD");

const futureDateIso = dateIso.refine(
  (d) => new Date(d) > new Date(),
  "Deadline must be in the future"
);

export const createOpportunitySchema = z
  .object({
    org_id: z.string().min(8),
    title: z.string().trim().min(5, "Title must be at least 5 characters").max(200),
    type: z.enum(["trial", "recruitment", "scholarship", "tournament", "coaching_job"]),
    sport: z.string().refine((s) => VALID_SPORTS.includes(s), { message: "Invalid sport — must be one of the supported sports" }),
    description: z.string().trim().min(20, "Description must be at least 20 characters").max(5000),
    eligibility: z.string().max(2000).optional(),
    age_min: z.number().int().min(0).max(120),
    age_max: z.number().int().min(0).max(120),
    gender_eligibility: z.enum(["all", "male", "female", "other"]).default("all"),
    experience_level_required: z
      .enum(["any", "beginner", "amateur", "semi_pro", "professional"])
      .default("any"),
    country: z.string().min(2).max(200),
    state: z.string().min(1).max(200),
    city: z.string().min(1).max(200),
    start_date: dateIso.optional(),
    end_date: dateIso.optional(),
    application_deadline: futureDateIso,
    entry_fee: z.number().nonnegative().optional(),
    documents_required: z.array(z.string().max(120)).max(20).optional(),
    vacancies: z.number().int().min(1, "Vacancies must be at least 1").max(1000, "Vacancies cannot exceed 1000").optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().max(20).optional()
  })
  .strict()
  .refine((v) => v.age_max >= v.age_min, { message: "age_max must be >= age_min", path: ["age_max"] })
  .refine((v) => v.type === "coaching_job" || !!v.start_date, { message: "start_date is required", path: ["start_date"] })
  .refine((v) => v.type === "coaching_job" || !!v.end_date, { message: "end_date is required", path: ["end_date"] })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, { message: "end_date must be >= start_date", path: ["end_date"] })
  .refine((v) => !v.start_date || v.application_deadline <= v.start_date, {
    message: "application_deadline must be on or before start_date",
    path: ["application_deadline"]
  });

export const updateOpportunitySchema = z
  .object({
    title: z.string().trim().min(5).max(200).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    eligibility: z.string().max(2000).optional(),
    application_deadline: futureDateIso.optional(),
    vacancies: z.number().int().min(1).max(1000).optional(),
    status: z.enum(["open", "closed", "filled"]).optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().max(20).optional()
  })
  .strict();

export const listOpportunitiesQuery = z.object({
  sport: z.string().optional(),
  type: z.enum(["trial", "recruitment", "scholarship", "tournament", "coaching_job"]).optional(),
  sort: z.enum(["newest", "deadline"]).default("newest"),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // text search
  q: z.string().max(200).optional(),
  // legacy / extended filters kept for backwards compat
  status: z.enum(["open", "closed", "filled"]).optional(),
  org_id: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  verified_org: z.coerce.boolean().optional(),
});
