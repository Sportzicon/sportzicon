export interface Blog {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  slug: string;
  excerpt: string;
  body_markdown: string;
  cover_image_url?: string;
  tags?: string[];
  sport?: string;
  status: "draft" | "published";
  like_count: number;
  comment_count: number;
  view_count: number;
  published_at?: number;
  created_at: number;
}

export interface BlogFilters {
  status?: string;
  sport?: string;
  tag?: string;
}
