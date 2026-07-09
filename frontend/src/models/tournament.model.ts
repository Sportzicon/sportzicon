export interface OrgTeamStanding {
  matches_played: number;
  wins: number;
  losses: number;
  ties: number;
  points: number;
}

export interface OrgTeam {
  id: string;
  org_tournament_id: string;
  name: string;
  scoring_team_id?: string | null;
  standing?: OrgTeamStanding | null;
}

export interface OrgTournament {
  id: string;
  organization_id: string;
  name: string;
  sport: string;
  season?: string | null;
  status: "upcoming" | "ongoing" | "completed";
  scoring_tournament_id?: string | null;
  organization?: { org_name: string; owner_user_id: string };
  teams?: OrgTeam[];
  created_at: string;
  updated_at: string;
}

export interface OrgTournamentFilters {
  status?: "upcoming" | "ongoing" | "completed";
  sport?: string;
  cursor?: string;
  limit?: number;
}

export interface OrgTournamentPage {
  data: OrgTournament[];
  nextCursor: string | null;
}

export interface CreateOrgTournamentRequest {
  name: string;
  sport: string;
  season?: string;
  scoring_tournament_id?: string;
}

export interface UpdateOrgTournamentRequest extends Partial<CreateOrgTournamentRequest> {
  status?: "upcoming" | "ongoing" | "completed";
}

export interface CreateOrgTeamRequest {
  name: string;
  scoring_team_id?: string;
}
