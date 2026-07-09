import { z } from "zod";

export const requestAccessSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

export const athleteIdParamSchema = z.object({
  athleteId: z.string().min(8),
});

export const requestIdParamSchema = z.object({
  requestId: z.string().min(8),
});

export const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "revoked"]).optional(),
});

export const decisionBodySchema = z.object({
  status: z.enum(["approved", "rejected", "revoked"]),
});
