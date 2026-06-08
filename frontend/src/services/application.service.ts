import type { AxiosInstance } from "axios";
import type { Application } from "../models";

export class ApplicationService {
  constructor(private readonly client: AxiosInstance) {}

  async getMine(): Promise<Application[]> {
    const res = await this.client.get<{ items: Application[] }>("/applications/mine");
    return res.data.items;
  }

  async getForOpportunity(opportunityId: string): Promise<Application[]> {
    const res = await this.client.get<{ items: Application[] }>(`/opportunities/${opportunityId}/applicants`);
    return res.data.items;
  }

  async updateStatus(id: string, status: string, reason?: string): Promise<void> {
    await this.client.put(`/applications/${id}/status`, { status, reason });
  }

  async withdraw(id: string): Promise<void> {
    await this.client.put(`/applications/${id}/status`, { status: "withdrawn" });
  }
}
