import type { AxiosInstance } from "axios";
import type { Reel } from "../models";

export interface CreateReelRequest {
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  caption?: string;
  sport?: string;
  duration_seconds?: number;
}

export interface UpdateReelRequest {
  title?: string;
  description?: string;
  sport?: string;
}

export interface ReelPage {
  items: Reel[];
  next_cursor: string | null;
}

export class ReelService {
  constructor(private readonly client: AxiosInstance) {}

  async list(params?: { limit?: number; cursor?: string; author_id?: string; sport?: string }): Promise<ReelPage> {
    const res = await this.client.get<ReelPage>("/reels", {
      params: { limit: params?.limit ?? 10, ...params }
    });
    return res.data;
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

  async like(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.post<{ like_count: number; liked: boolean }>(`/reels/${id}/like`);
    return res.data;
  }

  async unlike(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.delete<{ like_count: number; liked: boolean }>(`/reels/${id}/like`);
    return res.data;
  }

  async getUploadUrl(params: {
    context: "reel" | "post" | "avatar" | "org-logo" | "blog-cover" | "org-doc";
    fileName: string;
    contentType: string;
  }): Promise<{ upload_url: string; headers: Record<string, string>; public_url?: string; object_name: string }> {
    const res = await this.client.post("/media/upload-url", params);
    return res.data;
  }
}
