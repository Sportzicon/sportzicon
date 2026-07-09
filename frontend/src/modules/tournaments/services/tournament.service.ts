import type { AxiosInstance } from "axios";
import type {
  OrgTournament,
  OrgTournamentFilters,
  OrgTournamentPage,
  CreateOrgTournamentRequest,
  UpdateOrgTournamentRequest,
  CreateOrgTeamRequest,
  OrgTeam,
} from "../../../models";

export class TournamentService {
  constructor(private readonly client: AxiosInstance) {}

  async listGlobal(filters: OrgTournamentFilters = {}): Promise<OrgTournamentPage> {
    const res = await this.client.get<OrgTournamentPage>("/org-tournaments", { params: filters });
    return res.data;
  }

  async listForOrg(orgId: string): Promise<OrgTournament[]> {
    const res = await this.client.get<{ items: OrgTournament[] }>(`/organizations/${orgId}/org-tournaments`);
    return res.data.items;
  }

  async get(id: string): Promise<OrgTournament> {
    const res = await this.client.get<{ tournament: OrgTournament }>(`/org-tournaments/${id}`);
    return res.data.tournament;
  }

  async create(orgId: string, data: CreateOrgTournamentRequest): Promise<OrgTournament> {
    const res = await this.client.post<{ tournament: OrgTournament }>(`/organizations/${orgId}/org-tournaments`, data);
    return res.data.tournament;
  }

  async update(id: string, data: UpdateOrgTournamentRequest): Promise<OrgTournament> {
    const res = await this.client.put<{ tournament: OrgTournament }>(`/org-tournaments/${id}`, data);
    return res.data.tournament;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/org-tournaments/${id}`);
  }

  async addTeam(id: string, data: CreateOrgTeamRequest): Promise<OrgTeam> {
    const res = await this.client.post<{ team: OrgTeam }>(`/org-tournaments/${id}/teams`, data);
    return res.data.team;
  }

  async removeTeam(id: string, teamId: string): Promise<void> {
    await this.client.delete(`/org-tournaments/${id}/teams/${teamId}`);
  }
}
