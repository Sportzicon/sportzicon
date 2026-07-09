import type { AxiosInstance } from "axios";
import type { DocAccessStatus, DocumentAccessRequest } from "../../../models";

export class DocumentAccessService {
  constructor(private readonly client: AxiosInstance) {}

  async requestAccess(athleteId: string, reason?: string): Promise<DocumentAccessRequest> {
    const res = await this.client.post<{ request: DocumentAccessRequest }>(
      `/document-access/${athleteId}/requests`,
      { reason }
    );
    return res.data.request;
  }

  async listForAthlete(athleteId: string, status?: string): Promise<DocumentAccessRequest[]> {
    const res = await this.client.get<{ items: DocumentAccessRequest[] }>(
      `/document-access/${athleteId}/requests`,
      { params: status ? { status } : {} }
    );
    return res.data.items;
  }

  async getMyStatus(athleteId: string): Promise<DocAccessStatus | null> {
    const res = await this.client.get<{ status: DocAccessStatus | null }>(
      `/document-access/${athleteId}/my-status`
    );
    return res.data.status;
  }

  async decide(requestId: string, status: "approved" | "rejected" | "revoked"): Promise<DocumentAccessRequest> {
    const res = await this.client.patch<{ request: DocumentAccessRequest }>(
      `/document-access/requests/${requestId}`,
      { status }
    );
    return res.data.request;
  }
}
