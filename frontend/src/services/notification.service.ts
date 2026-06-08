import type { AxiosInstance } from "axios";
import type { Notification } from "../models";

export class NotificationService {
  constructor(private readonly client: AxiosInstance) {}

  async getUnreadCount(): Promise<number> {
    const res = await this.client.get<{ unread: number }>("/notifications/count");
    return res.data.unread;
  }

  async list(): Promise<Notification[]> {
    const res = await this.client.get<{ items: Notification[] }>("/notifications");
    return res.data.items;
  }

  async markAllRead(): Promise<void> {
    await this.client.post("/notifications/read-all");
  }
}
