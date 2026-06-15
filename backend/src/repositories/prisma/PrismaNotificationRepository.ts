import type { PrismaClient } from "@prisma/client";
import type {
  INotificationRepository,
  NotificationRecord,
  NotificationPage,
  CreateNotificationData,
} from "../interfaces/INotificationRepository";

const ACTOR_SELECT = {
  id: true,
  full_name: true,
  profile_photo_url: true,
} as const;

export class PrismaNotificationRepository implements INotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: CreateNotificationData): Promise<NotificationRecord> {
    const row = await this.db.notification.create({
      data,
      include: { actor: { select: ACTOR_SELECT } },
    });
    return row as unknown as NotificationRecord;
  }

  async findManyByUser(
    userId: string,
    limit = 20,
    cursor?: string
  ): Promise<NotificationPage> {
    const take = limit + 1;
    const rows = await this.db.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { actor: { select: ACTOR_SELECT } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      data: page as unknown as NotificationRecord[],
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
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

  async markOneRead(userId: string, id: string): Promise<{ updated: number }> {
    const result = await this.db.notification.updateMany({
      where: { id, user_id: userId },
      data: { read: true },
    });
    return { updated: result.count };
  }

  async deleteOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.notification.deleteMany({
      where: { created_at: { lt: cutoff } },
    });
    return result.count;
  }
}
