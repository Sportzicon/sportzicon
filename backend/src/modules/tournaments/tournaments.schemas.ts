import { z } from "zod";
import { VALID_SPORTS } from "../../utils/sportValidation";

export const ORG_TOURNAMENT_STATUSES = ["upcoming", "ongoing", "completed"] as const;

export const createOrgTournamentSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    sport: z.string().refine((s) => VALID_SPORTS.includes(s), { message: "Invalid sport" }),
    season: z.string().max(20).optional(),
    scoring_tournament_id: z.string().uuid().optional()
  })
  .strict();

export const updateOrgTournamentSchema = createOrgTournamentSchema
  .partial()
  .extend({ status: z.enum(ORG_TOURNAMENT_STATUSES).optional() })
  .strict();

export const createOrgTeamSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    scoring_team_id: z.string().uuid().optional()
  })
  .strict();
