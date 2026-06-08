export interface Organization {
  id: string;
  owner_user_id: string;
  org_name: string;
  org_type: string;
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
  registration_doc_url?: string;
  verification: { status: string; badges: string[] };
  subscription_plan?: string;
  created_at: number;
  updated_at: number;
}
