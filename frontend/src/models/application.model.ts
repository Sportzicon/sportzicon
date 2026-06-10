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
  org_id?: string;
  poster_user_id?: string;
  applicant_user_id: string;
  applicant_name?: string;
  cover_note?: string;
  documents?: string[];
  status: ApplicationStatus;
  rejection_reason?: string;
  history: ApplicationHistoryEntry[];
  applied_at: number;
  updated_at: number;
}
