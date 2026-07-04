import type { AxiosInstance } from "axios";
import type { CommentDoc, CommentParentType, AddCommentRequest, UpdateCommentRequest } from "../../../models";

export interface CommentPage {
  data: CommentDoc[];
  nextCursor: string | null;
}

export class CommentService {
  constructor(private readonly client: AxiosInstance) {}

  async list(parentType: CommentParentType, parentId: string, cursor?: string): Promise<CommentPage> {
    const res = await this.client.get<CommentPage>(`/${parentType}s/${parentId}/comments`, {
      params: cursor ? { cursor } : undefined
    });
    return res.data;
  }

  async add(parentType: CommentParentType, parentId: string, data: AddCommentRequest): Promise<CommentDoc> {
    const res = await this.client.post<{ comment: CommentDoc }>(`/${parentType}s/${parentId}/comments`, data);
    return res.data.comment;
  }

  async update(id: string, data: UpdateCommentRequest): Promise<void> {
    await this.client.put(`/comments/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`/comments/${id}`);
  }

  async like(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.post(`/comments/${id}/like`);
    return res.data;
  }

  async unlike(id: string): Promise<{ like_count: number; liked: boolean }> {
    const res = await this.client.delete(`/comments/${id}/like`);
    return res.data;
  }
}
