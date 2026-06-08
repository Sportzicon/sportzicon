import type { AxiosInstance } from "axios";

// ── Request / response shapes ────────────────────────────────────────────────

export interface ScoringMatch {
  id: string;
  status: string;
  tournament_id?: string;
  [key: string]: unknown;
}

export interface ScoringTournament {
  id: string;
  name: string;
  sport?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ScoringBall {
  id: string;
  innings_id: string;
  [key: string]: unknown;
}

export interface ScoringInnings {
  id: string;
  match_id: string;
  [key: string]: unknown;
}

export interface ScoringPlayerStats {
  batting?: Record<string, unknown>;
  bowling?: Record<string, unknown>;
}

export interface ScoringTeam {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ScoringStandings {
  [key: string]: unknown;
}

export interface CreateTournamentRequest {
  name: string;
  sport?: string;
  format?: string;
  start_date?: string;
  end_date?: string;
  [key: string]: unknown;
}

export interface CreateMatchRequest {
  team_a_id: string;
  team_b_id: string;
  match_date?: string;
  [key: string]: unknown;
}

export interface AddBallRequest {
  runs?: number;
  extras?: Record<string, unknown>;
  wicket?: Record<string, unknown>;
  [key: string]: unknown;
}

// ── Service class ─────────────────────────────────────────────────────────────

export class ScoringService {
  constructor(private readonly client: AxiosInstance) {}

  // ── Matches ────────────────────────────────────────────────────────────────

  async getLiveMatches(): Promise<ScoringMatch[]> {
    const res = await this.client.get<{ matches: ScoringMatch[] }>("/matches/live");
    return res.data.matches;
  }

  async getMatch(matchId: string): Promise<ScoringMatch> {
    const res = await this.client.get<{ match: ScoringMatch }>(`/matches/${matchId}`);
    return res.data.match;
  }

  async updateMatch(matchId: string, data: Record<string, unknown>): Promise<ScoringMatch> {
    const res = await this.client.put<{ match: ScoringMatch }>(`/matches/${matchId}`, data);
    return res.data.match;
  }

  async createMatchInnings(matchId: string, data: Record<string, unknown>): Promise<ScoringInnings> {
    const res = await this.client.post<{ innings: ScoringInnings }>(`/matches/${matchId}/innings`, data);
    return res.data.innings;
  }

  async getMatchXI(matchId: string): Promise<Record<string, unknown>> {
    const res = await this.client.get(`/matches/${matchId}/xi`);
    return res.data;
  }

  async setMatchXI(matchId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await this.client.post(`/matches/${matchId}/xi`, data);
    return res.data;
  }

  // ── Innings ────────────────────────────────────────────────────────────────

  async getBalls(inningsId: string): Promise<ScoringBall[]> {
    const res = await this.client.get<{ balls: ScoringBall[] }>(`/innings/${inningsId}/balls`);
    return res.data.balls ?? [];
  }

  async addBall(inningsId: string, data: AddBallRequest): Promise<ScoringBall> {
    const res = await this.client.post<{ ball: ScoringBall }>(`/innings/${inningsId}/balls`, data);
    return res.data.ball;
  }

  async undoBall(inningsId: string): Promise<void> {
    await this.client.post(`/innings/${inningsId}/balls/undo`);
  }

  async getInningsAnalytics(inningsId: string): Promise<Record<string, unknown>> {
    const res = await this.client.get(`/innings/${inningsId}/analytics`);
    return res.data;
  }

  async getPartnerships(inningsId: string): Promise<unknown[]> {
    const res = await this.client.get<{ partnerships: unknown[] }>(`/innings/${inningsId}/partnerships`);
    return res.data.partnerships;
  }

  async retireHurt(inningsId: string, playerId: string): Promise<void> {
    await this.client.post(`/innings/${inningsId}/retire-hurt`, { player_id: playerId });
  }

  async returnFromRetiredHurt(inningsId: string, playerId: string): Promise<void> {
    await this.client.post(`/innings/${inningsId}/return-from-retired-hurt`, { player_id: playerId });
  }

  async getRetiredHurtPlayers(inningsId: string): Promise<unknown[]> {
    const res = await this.client.get<{ players: unknown[] }>(`/innings/${inningsId}/retired-hurt`);
    return res.data.players ?? [];
  }

  // ── Tournaments ───────────────────────────────────────────────────────────

  async getTournaments(params?: Record<string, string>): Promise<{ tournaments?: unknown[]; [key: string]: unknown }> {
    const res = await this.client.get("/tournaments", { params });
    return res.data;
  }

  async getTournament(id: string): Promise<ScoringTournament> {
    const res = await this.client.get<{ tournament: ScoringTournament }>(`/tournaments/${id}`);
    return res.data.tournament;
  }

  async createTournament(data: CreateTournamentRequest): Promise<ScoringTournament> {
    const res = await this.client.post<{ tournament: ScoringTournament }>("/tournaments", data);
    return res.data.tournament;
  }

  async updateTournament(id: string, data: Partial<CreateTournamentRequest>): Promise<ScoringTournament> {
    const res = await this.client.put<{ tournament: ScoringTournament }>(`/tournaments/${id}`, data);
    return res.data.tournament;
  }

  async getTournamentStandings(tournamentId: string): Promise<ScoringStandings> {
    const res = await this.client.get(`/tournaments/${tournamentId}/standings`);
    return res.data;
  }

  async createTeam(tournamentId: string, data: Record<string, unknown>): Promise<ScoringTeam> {
    const res = await this.client.post<{ team: ScoringTeam }>(`/tournaments/${tournamentId}/teams`, data);
    return res.data.team;
  }

  async deleteTeam(tournamentId: string, teamId: string): Promise<void> {
    await this.client.delete(`/tournaments/${tournamentId}/teams/${teamId}`);
  }

  async addPlayer(tournamentId: string, teamId: string, data: Record<string, unknown>): Promise<void> {
    await this.client.post(`/tournaments/${tournamentId}/teams/${teamId}/players`, data);
  }

  async removePlayer(tournamentId: string, teamId: string, playerId: string): Promise<void> {
    await this.client.delete(`/tournaments/${tournamentId}/teams/${teamId}/players/${playerId}`);
  }

  async createMatch(tournamentId: string, data: CreateMatchRequest): Promise<ScoringMatch> {
    const res = await this.client.post<{ match: ScoringMatch }>(`/tournaments/${tournamentId}/matches`, data);
    return res.data.match;
  }

  // ── Players ────────────────────────────────────────────────────────────────

  async getPlayerStats(userId: string): Promise<ScoringPlayerStats> {
    const res = await this.client.get<ScoringPlayerStats>(`/players/by-user/${userId}/stats`);
    return res.data;
  }
}
