import type { Role } from "./user.model";
import type { JSONContent } from "@tiptap/react";

export interface PostAuthor {
  id: string;
  full_name: string;
  role: Role;
  profile_photo_url?: string;
}

export interface PostMedia {
  url: string;
  type: "image" | "video";
  thumbnail_url?: string;
}

export interface Post {
  id: string;
  author_id: string;
  author?: PostAuthor;
  author_name?: string;
  author_role?: Role;
  type: "log" | "post";
  content_json: JSONContent;
  media: PostMedia[];
  sport?: string;
  tags?: string[];
  like_count: number;
  comment_count: number;
  liked?: boolean;
  hidden?: boolean;
  created_at: string | number;
}

export interface CreatePostRequest {
  type: "log" | "post";
  content_json: JSONContent;
  media?: PostMedia[];
  sport?: string;
  tags?: string[];
}

export interface UpdatePostRequest {
  content_json?: JSONContent;
  media?: PostMedia[];
  tags?: string[];
}
