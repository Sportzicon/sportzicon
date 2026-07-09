import type { AxiosInstance } from "axios";
import type { User, UpdateAthleteRequest, Tournament, NewTournament, ScorecardPreview, UserDocument } from "../../../models";

export class UserService {
  constructor(private readonly client: AxiosInstance) {}

  async get(id: string): Promise<User> {
    const res = await this.client.get<{ user: User }>(`/users/${id}`);
    return res.data.user;
  }

  async updateAthleteProfile(data: UpdateAthleteRequest): Promise<User> {
    const res = await this.client.put<{ user: User }>("/users/me/athlete", data);
    return res.data.user;
  }

  async follow(userId: string): Promise<void> {
    await this.client.post(`/users/${userId}/follow`);
  }

  async unfollow(userId: string): Promise<void> {
    await this.client.delete(`/users/${userId}/follow`);
  }

  async listTournaments(userId: string): Promise<Tournament[]> {
    const res = await this.client.get<{ items: Tournament[] }>(`/users/${userId}/tournaments`);
    return res.data.items;
  }

  async addTournament(userId: string, data: NewTournament): Promise<Tournament> {
    const res = await this.client.post<{ tournament: Tournament }>(`/users/${userId}/tournaments`, data);
    return res.data.tournament;
  }

  async updateTournament(userId: string, tournamentId: string, data: NewTournament): Promise<Tournament> {
    const res = await this.client.put<{ tournament: Tournament }>(`/users/${userId}/tournaments/${tournamentId}`, data);
    return res.data.tournament;
  }

  async deleteTournament(userId: string, tournamentId: string): Promise<void> {
    await this.client.delete(`/users/${userId}/tournaments/${tournamentId}`);
  }

  async getScorecardLinkPreview(url: string): Promise<ScorecardPreview> {
    const res = await this.client.post<ScorecardPreview>("/users/me/scorecard-link-preview", { url });
    return res.data;
  }

  async getDocuments(userId: string): Promise<UserDocument[]> {
    const res = await this.client.get<{ items: UserDocument[] }>(`/users/${userId}/documents`);
    return res.data.items;
  }

  async uploadDocument(
    userId: string,
    file: File,
    type: string,
    onProgress?: (pct: number) => void
  ): Promise<UserDocument> {
    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    const res = await this.client.post<{ document: UserDocument }>(`/users/${userId}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data.document;
  }

  async deleteDocument(userId: string, docId: string): Promise<void> {
    await this.client.delete(`/users/${userId}/documents/${docId}`);
  }
}
