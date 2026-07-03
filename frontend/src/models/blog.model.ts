export interface BlogAuthor {
  id: string;
  full_name: string;
  profile_photo_url?: string | null;
}

export interface Blog {
  id: string;
  author_id: string;
  author_name: string;
  author?: BlogAuthor;
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url?: string | null;
  tags?: string[];
  sport?: string;
  status: "draft" | "published";
  like_count: number;
  comment_count: number;
  liked?: boolean;
  published_at?: number;
  created_at: number;
  updated_at?: number;
}

export interface BlogFilters {
  status?: string;
  sport?: string;
  tag?: string;
  q?: string;
  author_id?: string;
}

export interface BlogListResponse {
  items: Blog[];
  next_cursor: string | null;
}
