export type Role = "athlete" | "club" | "scout" | "organizer" | "admin" | "scorer";

export interface UserDocument {
  id: string;
  type: string;
  file_name: string;
  size_bytes: number;
  created_at: string;
  url: string;
}

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
  is_minor?: boolean;
  guardian_consent_status?: "not_applicable" | "pending" | "approved";
  guardian_consent_at?: number;
  guardian_email?: string;
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

export interface Tournament {
  id: string;
  name: string;
  year: string;
  team?: string;
  format?: string;
  result?: string;
  created_at: string;
}

export interface NewTournament {
  name: string;
  year: string;
  team?: string;
  format?: string;
  result?: string;
}

export interface ScorecardLink {
  url: string;
  label?: string;
  source?: string;
  preview_title?: string;
  preview_image?: string;
}

export interface ScorecardPreview {
  source: string;
  title: string | null;
  image: string | null;
}
