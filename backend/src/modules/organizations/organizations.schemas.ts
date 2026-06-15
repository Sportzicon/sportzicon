import { z } from "zod";
import { VALID_SPORTS } from "../../utils/sportValidation";

export const ORG_TYPES = ["club", "academy", "school", "university", "association"] as const;

export const createOrgSchema = z
  .object({
    org_name: z.string().trim().min(2).max(200),
    org_type: z.enum(ORG_TYPES),
    description: z.string().max(2000).optional(),
    logo_url: z.string().url().optional().or(z.literal("")),
    cover_url: z.string().url().optional().or(z.literal("")),
    sport_categories: z
      .array(z.string().refine((s) => VALID_SPORTS.includes(s), { message: "Invalid sport" }))
      .min(1, "Select at least one sport")
      .max(5, "Maximum 5 sport categories")
      .optional(),
    year_established: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
    country: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    address: z.string().max(200).optional(),
    website: z.string().url().optional().or(z.literal("")),
    contact_name: z.string().max(120).optional(),
    contact_email: z.string().email().optional().or(z.literal("")),
    contact_phone: z.string().max(20).optional(),
    social_links: z.record(z.string(), z.string().url()).optional(),
    registration_doc_url: z.string().url().optional().or(z.literal(""))
  })
  .strict();

export const updateOrgSchema = createOrgSchema.partial();

export const addDocumentSchema = z.object({
  key: z.string().min(1).max(500),
  name: z.string().min(1).max(255)
});
