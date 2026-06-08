import type { AxiosInstance } from "axios";
import type { Blog, BlogFilters } from "../models";

export class BlogService {
  constructor(private readonly client: AxiosInstance) {}

  async list(filters: BlogFilters = {}): Promise<Blog[]> {
    const res = await this.client.get<{ items: Blog[] }>("/blogs", { params: filters });
    return res.data.items;
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

  async like(id: string): Promise<void> {
    await this.client.post(`/blogs/${id}/like`);
  }

  async unlike(id: string): Promise<void> {
    await this.client.delete(`/blogs/${id}/like`);
  }
}
