export interface ReelAuthor {
  id: string;
  full_name: string;
  profile_photo_url?: string;
}

export interface Reel {
  id: string;
  author_id: string;
  author?: ReelAuthor;
  author_name?: string;
  title?: string;
  description?: string;
  caption?: string;
  video_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  sport?: string;
  like_count: number;
  comment_count: number;
  hidden?: boolean;
  created_at: string | number;
}
