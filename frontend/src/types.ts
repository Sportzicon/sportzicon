// Shape of values returned by the API. Kept loose - the API is the source of truth.

export type Role = "athlete" | "club" | "scout" | "organizer" | "admin";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  status: "active" | "suspended" | "pending";
  email_verified: boolean;
  bio?: string;
  profile_photo_url?: string;
  cover_photo_url?: string;
  country?: string;
  state?: string;
  city?: string;
  dob?: string;
  gender?: string;
  verification: { status: string; badges: string[] };
  athlete?: any;
  coach?: any;
  follower_count: number;
  following_count: number;
  created_at: number;
  updated_at: number;
}

export interface Organization {
  id: string;
  owner_user_id: string;
  org_name: string;
  org_type: "club" | "academy" | "both";
  description?: string;
  logo_url?: string;
  sport_categories: string[];
  country?: string;
  state?: string;
  city?: string;
  contact_email?: string;
  contact_phone?: string;
  verification: { status: string; badges: string[] };
  created_at: number;
}

export interface Opportunity {
  id: string;
  org_id: string;
  org_name: string;
  posted_by_user_id: string;
  title: string;
  type: string;
  sport: string;
  description: string;
  eligibility?: string;
  age_min: number;
  age_max: number;
  gender_eligibility: string;
  experience_level_required: string;
  country: string;
  state: string;
  city: string;
  start_date: string;
  end_date: string;
  application_deadline: string;
  vacancies?: number;
  vacancies_filled: number;
  status: "open" | "closed" | "filled";
  application_count: number;
  contact_email?: string;
  created_at: number;
}

export interface Application {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  org_id: string;
  applicant_user_id: string;
  applicant_name: string;
  cover_note?: string;
  status: "pending" | "shortlisted" | "selected" | "rejected" | "withdrawn";
  rejection_reason?: string;
  history: { status: string; at: number; by: string; reason?: string }[];
  applied_at: number;
  updated_at: number;
}

export interface Post {
  id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  type: "log" | "post";
  text: string;
  media_urls?: string[];
  sport?: string;
  tags?: string[];
  like_count: number;
  comment_count: number;
  created_at: number;
}

export interface Reel {
  id: string;
  author_id: string;
  author_name: string;
  caption?: string;
  video_url: string;
  thumbnail_url?: string;
  duration_seconds?: number;
  sport?: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: number;
}

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

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  created_at: number;
}

export interface CommentDoc {
  id: string;
  parent_type: "post" | "reel" | "blog";
  parent_id: string;
  author_id: string;
  author_name: string;
  text: string;
  created_at: number;
}
