import { z } from "zod";

export const createOrgSchema = z
  .object({
    org_name: z.string().min(2).max(120),
    org_type: z.enum(["club", "academy", "both"]),
    description: z.string().max(2000).optional(),
    logo_url: z.string().url().optional(),
    cover_url: z.string().url().optional(),
    sport_categories: z.array(z.string().max(60)).max(20).optional(),
    year_established: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
    country: z.string().max(80).optional(),
    state: z.string().max(80).optional(),
    city: z.string().max(80).optional(),
    address: z.string().max(300).optional(),
    website: z.string().url().optional(),
    contact_name: z.string().max(120).optional(),
    contact_email: z.string().email().optional(),
    contact_phone: z.string().max(20).optional(),
    social_links: z.record(z.string(), z.string().url()).optional(),
    registration_doc_url: z.string().url().optional()
  })
  .strict();

export const updateOrgSchema = createOrgSchema.partial();
