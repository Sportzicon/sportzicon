export type ApplicationStatus = "pending" | "shortlisted" | "selected" | "rejected" | "withdrawn";

export interface ApplicationHistoryEntry {
  status: string;
  at: string | number;
  by: string;
  reason?: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  opportunity_title?: string;
  opportunity_sport?: string;
  opportunity_type?: string;
  org_id?: string;
  org_name?: string;
  poster_user_id?: string;
  applicant_user_id: string;
  applicant_name?: string;
  applicant?: {
    id: string;
    full_name: string;
    profile_photo_url?: string | null;
    country?: string | null;
    city?: string | null;
    athlete_data?: unknown;
    verification?: { status: string; badges: string[] };
  };
  cover_note?: string;
  documents?: string[];
  status: ApplicationStatus;
  rejection_reason?: string;
  history: ApplicationHistoryEntry[];
  applied_at: number;
  updated_at: number;
}
