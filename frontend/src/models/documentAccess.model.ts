export type DocAccessStatus = "pending" | "approved" | "rejected" | "revoked";

export interface DocumentAccessRequest {
  id: string;
  requester_id: string;
  athlete_id: string;
  status: DocAccessStatus;
  reason?: string | null;
  requested_at: string;
  decided_at?: string | null;
  requester?: {
    id: string;
    full_name: string;
    role: string;
    profile_photo_url?: string | null;
  };
}
