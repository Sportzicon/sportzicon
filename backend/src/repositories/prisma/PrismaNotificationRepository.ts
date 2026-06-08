import type { PrismaClient } from "@prisma/client";
import type {
  INotificationRepository,
  NotificationRecord,
  CreateNotificationData,
} from "../interfaces/INotificationRepository";

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateNotificationData): Promise<NotificationRecord> {
    return this.db.notification.create({ data }) as unknown as NotificationRecord;
  }

  async findManyByUser(
    userId: string,
    limit = 50,
    unreadOnly = false
  ): Promise<NotificationRecord[]> {
    return this.db.notification.findMany({
      where: { user_id: userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { created_at: "desc" },
      take: limit,
    }) as unknown as NotificationRecord[];
  }

  async countUnread(userId: string): Promise<number> {
    return this.db.notification.count({ where: { user_id: userId, read: false } });
  }

  async markRead(userId: string, ids?: string[]): Promise<{ updated: number }> {
    const result = ids?.length
      ? await this.db.notification.updateMany({
          where: { id: { in: ids }, user_id: userId },
          data: { read: true },
        })
      : await this.db.notification.updateMany({
          where: { user_id: userId, read: false },
          data: { read: true },
        });

    return { updated: result.count };
  }
}
