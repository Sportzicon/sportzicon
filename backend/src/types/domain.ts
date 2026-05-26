// Domain types shared across modules. Mirrors the SRS data model on Firestore.

export type Role = "athlete" | "club" | "scout" | "organizer" | "admin";

export const ROLES: Role[] = ["athlete", "club", "scout", "organizer", "admin"];

export type AccountStatus = "active" | "suspended" | "pending";
export type ApplicationStatus = "pending" | "shortlisted" | "selected" | "rejected" | "withdrawn";
export type OpportunityType = "trial" | "recruitment" | "scholarship" | "tournament" | "coaching_job";
export type OpportunityStatus = "open" | "closed" | "filled";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type EntityType = "user" | "organization";
export type ReportStatus = "open" | "actioned" | "dismissed";

export interface UserDoc {
  id: string;
  email: string;
  email_lower: string;
  email_verified: boolean;
  phone: string;
  phone_verified: boolean;
  password_hash: string;
  full_name: string;
  full_name_lower: string;
  role: Role;
  status: AccountStatus;
  bio?: string;
  profile_photo_url?: string;
  cover_photo_url?: string;
  country?: string;
  state?: string;
  city?: string;
  dob?: string; // ISO date
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  preferred_language?: string;
  verification: {
    badges: string[];
    status: VerificationStatus;
  };
  // Athlete-specific fields
  athlete?: {
    primary_sport?: string;
    secondary_sports?: string[];
    playing_role?: string;
    position?: string;
    style?: string;
    dominance?: string;
    height_cm?: number;
    weight_kg?: number;
    experience_level?: "beginner" | "amateur" | "semi_pro" | "professional";
    current_team?: string;
    previous_teams?: { team: string; years: string }[];
    achievements?: { title: string; year: number; description?: string; proof_url?: string }[];
    stats?: Record<string, number | string>;
    cv_url?: string;
    availability?: "available" | "not_available" | "open_to_offers";
    looking_for_club?: boolean;
  };
  // Coach/scout-specific fields
  coach?: {
    specialization?: string;
    sport?: string;
    experience_years?: number;
    past_organizations?: string[];
    certification_urls?: string[];
    regions?: string[];
    hiring_status?: "available" | "not_available";
  };
  follower_count: number;
  following_count: number;
  created_at: number; // ms epoch
  updated_at: number;
  last_active_at: number;
}

export interface OrganizationDoc {
  id: string;
  owner_user_id: string;
  org_name: string;
  org_name_lower: string;
  org_type: "club" | "academy" | "both";
  description?: string;
  logo_url?: string;
  cover_url?: string;
  sport_categories: string[];
  year_established?: number;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  social_links?: Record<string, string>;
  registration_doc_url?: string;
  verification: {
    status: VerificationStatus;
    badges: string[];
  };
  subscription_plan: "free" | "premium";
  created_at: number;
  updated_at: number;
}

export interface OpportunityDoc {
  id: string;
  org_id: string;
  org_name: string; // denormalised for list views
  posted_by_user_id: string;
  title: string;
  title_lower: string;
  type: OpportunityType;
  sport: string;
  description: string;
  eligibility?: string;
  age_min: number;
  age_max: number;
  gender_eligibility: "all" | "male" | "female" | "other";
  experience_level_required: "any" | "beginner" | "amateur" | "semi_pro" | "professional";
  country: string;
  state: string;
  city: string;
  start_date: string; // ISO
  end_date: string; // ISO
  application_deadline: string; // ISO
  entry_fee?: number;
  documents_required?: string[];
  vacancies?: number;
  vacancies_filled: number;
  contact_email?: string;
  contact_phone?: string;
  status: OpportunityStatus;
  application_count: number;
  created_at: number;
  updated_at: number;
}

export interface ApplicationDoc {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  org_id: string;
  applicant_user_id: string;
  applicant_name: string;
  cover_note?: string;
  documents?: string[];
  status: ApplicationStatus;
  rejection_reason?: string;
  history: { status: ApplicationStatus; at: number; by: string; reason?: string }[];
  applied_at: number;
  updated_at: number;
}

export interface FollowDoc {
  id: string; // `${follower_id}_${followee_id}`
  follower_id: string;
  followee_id: string;
  created_at: number;
}

export interface PostDoc {
  id: string;
  author_id: string;
  author_name: string;
  author_role: Role;
  type: "log" | "post"; // log = training log; post = generic
  text: string;
  media_urls?: string[];
  sport?: string;
  tags?: string[];
  like_count: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
}

export interface ReelDoc {
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

export interface BlogDoc {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  title_lower: string;
  slug: string;
  cover_image_url?: string;
  excerpt: string;
  body_markdown: string;
  tags?: string[];
  sport?: string;
  status: "draft" | "published";
  like_count: number;
  comment_count: number;
  view_count: number;
  published_at?: number;
  created_at: number;
  updated_at: number;
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

export interface MessageDoc {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at?: number;
  flagged?: boolean;
  created_at: number;
}

export interface ConversationDoc {
  id: string; // sorted pair id `${a}_${b}`
  participant_ids: string[];
  last_message?: { body: string; sender_id: string; at: number };
  unread_counts: Record<string, number>;
  created_at: number;
  updated_at: number;
}

export interface NotificationDoc {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  created_at: number;
}

export interface AuditLogDoc {
  id: string;
  actor_id: string;
  actor_role: Role;
  action: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
  ip?: string;
  created_at: number;
}

export interface ReportDoc {
  id: string;
  reporter_id: string;
  target_type: "user" | "organization" | "post" | "reel" | "blog" | "message" | "opportunity";
  target_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by?: string;
  resolved_at?: number;
  notes?: string;
  created_at: number;
}

export interface VerificationDoc {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  verification_type: string;
  documents: string[];
  notes?: string;
  status: VerificationStatus;
  submitted_by: string;
  reviewed_by?: string;
  reviewed_at?: number;
  rejection_reason?: string;
  created_at: number;
}
