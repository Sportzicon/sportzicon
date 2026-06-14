import type { AxiosInstance } from "axios";
import type { Blog, BlogFilters, BlogListResponse } from "../models";

export class BlogService {
  constructor(private readonly client: AxiosInstance) {}

  async list(filters: BlogFilters & { cursor?: string; limit?: number } = {}): Promise<BlogListResponse> {
    const res = await this.client.get<BlogListResponse>("/blogs", { params: filters });
    return res.data;
  }

  async get(id: string): Promise<Blog> {
    const res = await this.client.get<{ blog: Blog }>(`/blogs/${id}`);
    return res.data.blog;
  }

  async create(data: Partial<Blog>): Promise<Blog> {
    const res = await this.client.post<{ blog: Blog }>("/blogs", data);
    return res.data.blog;
  }

  async update(id: string, data: Partial<Blog>): Promise<Blog> {
    const res = await this.client.put<{ blog: Blog }>(`/blogs/${id}`, data);
    return res.data.blog;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/blogs/${id}`);
  }

  async like(id: string): Promise<{ ok: boolean; liked: boolean }> {
    const res = await this.client.post<{ ok: boolean; liked: boolean }>(`/blogs/${id}/like`);
    return res.data;
  }

  async unlike(id: string): Promise<{ ok: boolean; liked: boolean }> {
    const res = await this.client.delete<{ ok: boolean; liked: boolean }>(`/blogs/${id}/like`);
    return res.data;
  }
}
