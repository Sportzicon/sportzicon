import { z } from "zod";
import { ROLES } from "../../types/domain";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .refine((v) => /[A-Z]/.test(v), "Must contain an uppercase letter")
  .refine((v) => /[a-z]/.test(v), "Must contain a lowercase letter")
  .refine((v) => /[0-9]/.test(v), "Must contain a digit");

// Public registration cannot create admin users.
const publicRoles = ROLES.filter((r) => r !== "admin") as ["athlete", "club", "scout", "organizer"];

export const signupSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
  full_name: z.string().min(2).max(120),
  phone: z.string().min(7).max(20),
  role: z.enum(publicRoles),
  // optional fields from onboarding step 2 (account details)
  country: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  dob: z.string().max(20).optional(),
  gender: z.string().max(30).optional(),
  // optional fields from onboarding step 3 (sport profile / org)
  primary_sport: z.string().max(60).optional(),
  position: z.string().max(80).optional(),
  experience_level: z.string().max(40).optional(),
  looking_for_club: z.boolean().optional(),
  org_name: z.string().max(120).optional(),
  org_type: z.string().max(40).optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(20)
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20)
});

export const forgotPasswordSchema = z.object({
  email: z.string().email()
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
});
