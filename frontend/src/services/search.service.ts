import type { AxiosInstance } from "axios";

export type SearchMode = "players" | "clubs" | "opportunities";

export interface SearchPage<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

export interface PlayerSearchParams {
  q?: string;
  sport?: string;
  sort?: "newest" | "verified";
  cursor?: string;
  limit?: number;
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
}

export interface ClubSearchParams {
  q?: string;
  sport?: string;
  sort?: "newest" | "verified";
  cursor?: string;
  limit?: number;
  country?: string;
  state?: string;
  city?: string;
  org_type?: string;
  verified?: boolean;
}

export interface OpportunitySearchParams {
  q?: string;
  sport?: string;
  sort?: "newest" | "deadline";
  cursor?: string;
  limit?: number;
  country?: string;
  city?: string;
  type?: string;
  status?: string;
}

export type SearchParams = PlayerSearchParams | ClubSearchParams | OpportunitySearchParams;

export class SearchService {
  constructor(private readonly client: AxiosInstance) {}

  async searchPlayers(params: PlayerSearchParams): Promise<SearchPage<Record<string, unknown>>> {
    const res = await this.client.get<SearchPage<Record<string, unknown>>>("/search/players", { params });
    return res.data;
  }

  async searchClubs(params: ClubSearchParams): Promise<SearchPage<Record<string, unknown>>> {
    const res = await this.client.get<SearchPage<Record<string, unknown>>>("/search/clubs", { params });
    return res.data;
  }

  async searchOpportunities(params: OpportunitySearchParams): Promise<SearchPage<Record<string, unknown>>> {
    const res = await this.client.get<SearchPage<Record<string, unknown>>>("/search/opportunities", { params });
    return res.data;
  }
}
