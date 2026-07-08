import type { AxiosInstance } from "axios";
import type { ContentItem, CreatePostRequest, UpdatePostRequest } from "../../../models";

export interface FeedPage {
  data: ContentItem[];
  nextCursor: string | null;
}

export interface LikeResult {
  like_count: number;
  liked: boolean;
}

export class PostService {
  constructor(private readonly client: AxiosInstance) {}

  async getFeedPage(cursor?: string, limit = 20): Promise<FeedPage> {
    const res = await this.client.get<FeedPage>("/content/feed", {
      params: { limit, ...(cursor ? { cursor } : {}) }
    });
    return res.data;
  }

  async create(data: CreatePostRequest): Promise<void> {
    await this.client.post("/content", { content_type: "post", ...data });
  }

  async update(id: string, data: UpdatePostRequest): Promise<void> {
    await this.client.put(`/content/${id}`, { content_type: "post", ...data });
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/content/${id}`);
  }

  async like(id: string): Promise<LikeResult> {
    const res = await this.client.post<LikeResult>(`/content/${id}/like`);
    return res.data;
  }

  async unlike(id: string): Promise<LikeResult> {
    const res = await this.client.delete<LikeResult>(`/content/${id}/like`);
    return res.data;
  }
}
