import type { AxiosInstance } from "axios";
import type {
  Opportunity,
  OpportunityFilters,
  OpportunityPage,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
  ApplyRequest,
} from "../models";

export class OpportunityService {
  constructor(private readonly client: AxiosInstance) {}

  async list(filters: OpportunityFilters = {}): Promise<OpportunityPage> {
    const res = await this.client.get<OpportunityPage>("/opportunities", { params: filters });
    return res.data;
  }

  async get(id: string): Promise<Opportunity> {
    const res = await this.client.get<{ opportunity: Opportunity }>(`/opportunities/${id}`);
    return res.data.opportunity;
  }

  async create(data: CreateOpportunityRequest): Promise<Opportunity> {
    const res = await this.client.post<{ opportunity: Opportunity }>("/opportunities", data);
    return res.data.opportunity;
  }

  async update(id: string, data: UpdateOpportunityRequest): Promise<Opportunity> {
    const res = await this.client.put<{ opportunity: Opportunity }>(`/opportunities/${id}`, data);
    return res.data.opportunity;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/opportunities/${id}`);
  }

  async apply(id: string, data: ApplyRequest): Promise<void>;
  async apply(id: string, data: FormData): Promise<void>;
  async apply(id: string, data: ApplyRequest | FormData): Promise<void> {
    const headers = data instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined;
    await this.client.post(`/opportunities/${id}/apply`, data, { headers });
  }
}
