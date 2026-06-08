import type { OpportunityStatus } from "../../types/domain";

export interface OpportunityRecord {
  id: string;
  org_id: string;
  posted_by_user_id: string;
  title: string;
  type: string;
  sport: string;
  description: string;
  eligibility?: string | null;
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
  vacancies?: number | null;
  vacancies_filled: number;
  status: OpportunityStatus;
  application_count: number;
  contact_email?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OpportunityFilters {
  sport?: string;
  type?: string;
  country?: string;
  city?: string;
  status?: OpportunityStatus;
  org_id?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateOpportunityData {
  org_id: string;
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
  contact_email?: string;
}

export interface IOpportunityRepository {
  findById(id: string): Promise<OpportunityRecord | null>;
  findMany(filters: OpportunityFilters): Promise<OpportunityRecord[]>;
  create(data: CreateOpportunityData): Promise<OpportunityRecord>;
  update(id: string, data: Partial<OpportunityRecord>): Promise<OpportunityRecord>;
  delete(id: string): Promise<void>;
  incrementApplicationCount(id: string, delta?: number): Promise<void>;
  updateStatus(id: string, status: OpportunityStatus): Promise<void>;
  updateVacanciesFilled(id: string, delta: number): Promise<OpportunityRecord>;
}
