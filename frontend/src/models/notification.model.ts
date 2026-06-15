export interface NotificationActor {
  id: string;
  full_name: string;
  profile_photo_url?: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  created_at: number;
  actor?: NotificationActor | null;
}

export interface NotificationPage {
  data: Notification[];
  nextCursor: string | null;
}
