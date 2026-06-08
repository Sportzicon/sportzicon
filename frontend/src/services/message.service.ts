import type { AxiosInstance } from "axios";
import type { Conversation, Message, SendMessageRequest } from "../models";

export class MessageService {
  constructor(private readonly client: AxiosInstance) {}

  async getConversations(): Promise<Conversation[]> {
    const res = await this.client.get<{ items: Conversation[] }>("/conversations");
    return res.data.items;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    const res = await this.client.get<{ items: Message[] }>(`/conversations/${conversationId}/messages`);
    return res.data.items;
  }

  async send(data: SendMessageRequest): Promise<void> {
    await this.client.post("/messages", data);
  }

  async markRead(conversationId: string): Promise<void> {
    await this.client.post(`/conversations/${conversationId}/read`);
  }
}
