export interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  created_at: Date;
  actor?: {
    id: string;
    full_name: string;
    profile_photo_url?: string | null;
  } | null;
}

export interface CreateNotificationData {
  user_id: string;
  actor_id?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export interface NotificationPage {
  data: NotificationRecord[];
  nextCursor: string | null;
}

export interface INotificationRepository {
  create(data: CreateNotificationData): Promise<NotificationRecord>;
  findManyByUser(
    userId: string,
    limit?: number,
    cursor?: string
  ): Promise<NotificationPage>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, ids?: string[]): Promise<{ updated: number }>;
  markOneRead(userId: string, id: string): Promise<{ updated: number }>;
  deleteOlderThan(cutoff: Date): Promise<number>;
}
