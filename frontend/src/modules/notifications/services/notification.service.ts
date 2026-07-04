import type { AxiosInstance } from "axios";
import type { Notification, NotificationPage } from "../../../models";

export class NotificationService {
  constructor(private readonly client: AxiosInstance) {}

  async getUnreadCount(): Promise<number> {
    const res = await this.client.get<{ unread: number }>("/notifications/count");
    return res.data.unread;
  }

  async list(cursor?: string, limit = 20): Promise<NotificationPage> {
    const params: Record<string, unknown> = { limit };
    if (cursor) params.cursor = cursor;
    const res = await this.client.get<NotificationPage>("/notifications", { params });
    return res.data;
  }

  async markAllRead(): Promise<void> {
    await this.client.patch("/notifications/read-all");
  }

  async markOneRead(id: string): Promise<void> {
    await this.client.patch(`/notifications/${id}/read`);
  }
}
