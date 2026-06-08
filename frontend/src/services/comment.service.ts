import type { AxiosInstance } from "axios";
import type { CommentDoc, CommentParentType, AddCommentRequest, UpdateCommentRequest } from "../models";

export class CommentService {
  constructor(private readonly client: AxiosInstance) {}

  async list(parentType: CommentParentType, parentId: string): Promise<CommentDoc[]> {
    const res = await this.client.get<{ items: CommentDoc[] }>(`/${parentType}s/${parentId}/comments`);
    return res.data.items;
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
}
