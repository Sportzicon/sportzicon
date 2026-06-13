export interface Opportunity {
  id: string;
  org_id: string;
  org_name?: string;
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

export interface OpportunityFilters {
  status?: string;
  type?: string;
  sport?: string;
  verified_org?: boolean;
  q?: string;
  sort?: "newest" | "deadline";
  limit?: number;
  cursor?: string;
}

export interface OpportunityPage {
  data: Opportunity[];
  nextCursor: string | null;
}

export interface CreateOpportunityRequest {
  org_id: string;
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
}

export type UpdateOpportunityRequest = Partial<CreateOpportunityRequest>;

export interface ApplyRequest {
  cover_note: string;
}
