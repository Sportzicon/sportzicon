import type { AxiosInstance } from "axios";
import type { Conversation, Message, SendMessageRequest, CreateConversationRequest } from "../models";

export class MessageService {
  constructor(private readonly client: AxiosInstance) {}

  async getConversations(): Promise<Conversation[]> {
    const res = await this.client.get<{ items: Conversation[] }>("/conversations");
    return res.data.items;
  }

  async createConversation(data: CreateConversationRequest): Promise<{ id: string; created: boolean }> {
    const res = await this.client.post<{ id: string; created: boolean }>("/conversations", data);
    return res.data;
  }

  async getMessages(conversationId: string, cursor?: string): Promise<{ items: Message[]; next_cursor: string | null }> {
    const params = cursor ? `?cursor=${cursor}` : "";
    const res = await this.client.get<{ items: Message[]; next_cursor: string | null }>(
      `/conversations/${conversationId}/messages${params}`
    );
    return res.data;
  }

  async send(data: SendMessageRequest): Promise<{ conversation_id: string; id: string }> {
    const res = await this.client.post<{ conversation_id: string; id: string }>("/messages", data);
    return res.data;
  }

  async markRead(conversationId: string): Promise<void> {
    await this.client.post(`/conversations/${conversationId}/read`);
  }

}
