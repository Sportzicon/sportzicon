export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  created_at: Date;
}

export interface CreateNotificationData {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export interface INotificationRepository {
  create(data: CreateNotificationData): Promise<NotificationRecord>;
  findManyByUser(userId: string, limit?: number, unreadOnly?: boolean): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, ids?: string[]): Promise<{ updated: number }>;
}
