import type { AxiosInstance } from "axios";
import type { Post, CreatePostRequest, UpdatePostRequest } from "../models";

export class PostService {
  constructor(private readonly client: AxiosInstance) {}

  async getFeed(limit = 30): Promise<Post[]> {
    const res = await this.client.get<{ items: Post[] }>("/posts/feed", { params: { limit } });
    return res.data.items;
  }

  async create(data: CreatePostRequest): Promise<void> {
    await this.client.post("/posts", data);
  }

  async update(id: string, data: UpdatePostRequest): Promise<void> {
    await this.client.put(`/posts/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}`);
  }

  async like(id: string): Promise<void> {
    await this.client.post(`/posts/${id}/like`);
  }

  async unlike(id: string): Promise<void> {
    await this.client.delete(`/posts/${id}/like`);
  }
}
