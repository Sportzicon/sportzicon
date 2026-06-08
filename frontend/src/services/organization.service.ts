import type { AxiosInstance } from "axios";
import type { Organization } from "../models";

export class OrganizationService {
  constructor(private readonly client: AxiosInstance) {}

  async getMine(): Promise<Organization[]> {
    const res = await this.client.get<{ items: Organization[] }>("/organizations/mine");
    return res.data.items;
  }

  async get(id: string): Promise<Organization> {
    const res = await this.client.get<{ organization: Organization }>(`/organizations/${id}`);
    return res.data.organization;
  }

  async list(): Promise<Organization[]> {
    const res = await this.client.get<{ items: Organization[] }>("/organizations");
    return res.data.items;
  }
}
