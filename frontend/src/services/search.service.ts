import type { AxiosInstance } from "axios";

export type SearchMode = "players" | "clubs" | "opportunities";

export interface PlayerSearchParams {
  q?: string;
  sport?: string;
  country?: string;
  state?: string;
  city?: string;
  gender?: string;
  age_min?: number;
  age_max?: number;
  experience_level?: string;
  position?: string;
  available?: boolean;
  verified?: boolean;
  limit?: number;
}

export interface ClubSearchParams {
  q?: string;
  sport?: string;
  country?: string;
  state?: string;
  city?: string;
  org_type?: string;
  verified?: boolean;
  limit?: number;
}

export interface OpportunitySearchParams {
  q?: string;
  sport?: string;
  type?: string;
  country?: string;
  city?: string;
  status?: string;
  limit?: number;
}

export type SearchParams = PlayerSearchParams | ClubSearchParams | OpportunitySearchParams;

export class SearchService {
  constructor(private readonly client: AxiosInstance) {}

  async search<T = unknown>(mode: SearchMode, params: SearchParams): Promise<T[]> {
    const res = await this.client.get<{ items: T[] }>(`/search/${mode}`, { params });
    return res.data.items;
  }

  async searchPlayers(params: PlayerSearchParams) {
    return this.search<Record<string, unknown>>("players", params);
  }

  async searchClubs(params: ClubSearchParams) {
    return this.search<Record<string, unknown>>("clubs", params);
  }

  async searchOpportunities(params: OpportunitySearchParams) {
    return this.search<Record<string, unknown>>("opportunities", params);
  }
}
