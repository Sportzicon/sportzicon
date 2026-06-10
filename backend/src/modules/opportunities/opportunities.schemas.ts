import { z } from "zod";

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Use ISO date YYYY-MM-DD");
const today = () => new Date().toISOString().split("T")[0];

export const createOpportunitySchema = z
  .object({
    org_id: z.string().min(8),
    title: z.string().min(3).max(140),
    type: z.enum(["trial", "recruitment", "scholarship", "tournament", "coaching_job"]),
    sport: z.string().min(2).max(60),
    description: z.string().min(10).max(5000),
    eligibility: z.string().max(2000).optional(),
    age_min: z.number().int().min(0).max(120),
    age_max: z.number().int().min(0).max(120),
    gender_eligibility: z.enum(["all", "male", "female", "other"]).default("all"),
    experience_level_required: z
      .enum(["any", "beginner", "amateur", "semi_pro", "professional"])
      .default("any"),
    country: z.string().min(2).max(80),
    state: z.string().min(1).max(80),
    city: z.string().min(1).max(80),
    start_date: dateIso.optional(),
    end_date: dateIso.optional(),
    application_deadline: dateIso,
    entry_fee: z.number().nonnegative().optional(),
    documents_required: z.array(z.string().max(120)).max(20).optional(),
    vacancies: z.number().int().positive().optional(),
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
  })
  .refine((v) => v.application_deadline >= today(), {
    message: "application_deadline cannot be in the past",
    path: ["application_deadline"]
  });

export const updateOpportunitySchema = z
  .object({
    title: z.string().min(3).max(140).optional(),
    description: z.string().min(10).max(5000).optional(),
    eligibility: z.string().max(2000).optional(),
    application_deadline: dateIso.optional(),
    vacancies: z.number().int().positive().optional(),
    status: z.enum(["open", "closed", "filled"]).optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().max(20).optional()
  })
  .strict();

export const listOpportunitiesQuery = z.object({
  sport: z.string().optional(),
  type: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["open", "closed", "filled"]).optional(),
  org_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
});
