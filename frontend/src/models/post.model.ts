import type { Role } from "./user.model";

export interface PostAuthor {
  id: string;
  full_name: string;
  role: Role;
  profile_photo_url?: string;
}

export interface Post {
  id: string;
  author_id: string;
  author?: PostAuthor;
  author_name?: string;
  author_role?: Role;
  type: "log" | "post";
  text: string;
  media_urls?: string[];
  sport?: string;
  tags?: string[];
  like_count: number;
  comment_count: number;
  created_at: string | number;
}

export interface CreatePostRequest {
  type: "log" | "post";
  text: string;
  sport?: string;
  tags?: string[];
}

export interface UpdatePostRequest {
  text: string;
}
