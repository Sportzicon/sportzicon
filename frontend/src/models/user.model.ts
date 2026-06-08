export type Role = "athlete" | "club" | "scout" | "organizer" | "admin" | "scorer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
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
  preferred_language?: string;
  verification: { status: string; badges: string[] };
  athlete?: Record<string, any>;
  coach?: Record<string, any>;
  follower_count: number;
  following_count: number;
  created_at: number;
  updated_at: number;
  last_active_at?: number;
}

export interface UpdateAthleteRequest {
  availability?: string;
  primary_sport?: string;
  position?: string;
  level?: string;
  [key: string]: unknown;
}
