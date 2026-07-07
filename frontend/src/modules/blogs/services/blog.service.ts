import type { AxiosInstance } from "axios";
import type { Blog, BlogFilters, BlogListResponse } from "../../../models";

export class BlogService {
  constructor(private readonly client: AxiosInstance) {}

  async list(filters: BlogFilters & { cursor?: string; limit?: number } = {}): Promise<BlogListResponse> {
    const res = await this.client.get<BlogListResponse>("/content", { params: { content_type: "blog", ...filters } });
    return res.data;
  }

  async get(id: string): Promise<Blog> {
    const res = await this.client.get<{ content: Blog }>(`/content/${id}`);
    return res.data.content;
  }

  async create(data: Partial<Blog>): Promise<Blog> {
    const res = await this.client.post<{ content: Blog }>("/content", { content_type: "blog", ...data });
    return res.data.content;
  }

  async update(id: string, data: Partial<Blog>): Promise<Blog> {
    const res = await this.client.put<{ content: Blog }>(`/content/${id}`, { content_type: "blog", ...data });
    return res.data.content;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/content/${id}`);
  }

  async like(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.post<{ like_count: number; liked: boolean }>(`/content/${id}/like`);
    return res.data;
  }

  async unlike(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.delete<{ like_count: number; liked: boolean }>(`/content/${id}/like`);
    return res.data;
  }
}
