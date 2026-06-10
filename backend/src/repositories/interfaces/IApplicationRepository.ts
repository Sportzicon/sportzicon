import type { ApplicationStatus } from "../../types/domain";

export interface ApplicationRecord {
  id: string;
  opportunity_id: string;
  applicant_user_id: string;
  cover_note?: string | null;
  documents: string[];
  status: ApplicationStatus;
  rejection_reason?: string | null;
  history: object[];
  applied_at: Date;
  updated_at: Date;
}

export interface CreateApplicationData {
  opportunity_id: string;
  applicant_user_id: string;
  cover_note?: string;
  documents?: string[];
}

export interface UpdateApplicationData {
  status?: ApplicationStatus;
  rejection_reason?: string | null;
  history?: object[];
  cover_note?: string | null;
  documents?: string[];
}

export interface IApplicationRepository {
  findById(id: string): Promise<ApplicationRecord | null>;
  findByOpportunityAndApplicant(
    opportunityId: string,
    applicantId: string
  ): Promise<Pick<ApplicationRecord, "id" | "status"> | null>;
  findManyByApplicant(userId: string, limit?: number): Promise<ApplicationRecord[]>;
  findManyByOpportunity(opportunityId: string): Promise<ApplicationRecord[]>;
  create(data: CreateApplicationData): Promise<ApplicationRecord>;
  update(id: string, data: UpdateApplicationData): Promise<ApplicationRecord>;
}
