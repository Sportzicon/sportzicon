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
  role: z.enum(publicRoles)
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
