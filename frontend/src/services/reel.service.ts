import type { AxiosInstance } from "axios";
import type { Reel } from "../models";

export interface CreateReelRequest {
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  sport?: string;
  duration_seconds?: number;
}

export interface UpdateReelRequest {
  caption?: string;
  sport?: string;
}

export class ReelService {
  constructor(private readonly client: AxiosInstance) {}

  async list(limit = 50): Promise<Reel[]> {
    const res = await this.client.get<{ items: Reel[] }>("/reels", { params: { limit } });
    return res.data.items;
  }

  async create(data: CreateReelRequest): Promise<Reel> {
    const res = await this.client.post<{ reel: Reel }>("/reels", data);
    return res.data.reel;
  }

  async update(id: string, data: UpdateReelRequest): Promise<void> {
    await this.client.put(`/reels/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/reels/${id}`);
  }

  async like(id: string): Promise<void> {
    await this.client.post(`/reels/${id}/like`);
  }

  async unlike(id: string): Promise<void> {
    await this.client.delete(`/reels/${id}/like`);
  }

  async view(id: string): Promise<void> {
    await this.client.post(`/reels/${id}/view`);
  }
}
