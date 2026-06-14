import type { PrismaClient } from "@prisma/client";
import type {
  IApplicationRepository,
  ApplicationRecord,
  CreateApplicationData,
  UpdateApplicationData,
} from "../interfaces/IApplicationRepository";

export class PrismaApplicationRepository implements IApplicationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<ApplicationRecord | null> {
    return this.db.application.findUnique({ where: { id } }) as Promise<ApplicationRecord | null>;
  }

  async findByOpportunityAndApplicant(
    opportunityId: string,
    applicantId: string
  ): Promise<Pick<ApplicationRecord, "id" | "status"> | null> {
    return this.db.application.findUnique({
      where: {
        opportunity_id_applicant_user_id: {
          opportunity_id: opportunityId,
          applicant_user_id: applicantId,
        },
      },
      select: { id: true, status: true },
    });
  }

  async findManyByApplicant(userId: string, limit = 50): Promise<ApplicationRecord[]> {
    const rows = await this.db.application.findMany({
      where: { applicant_user_id: userId },
      orderBy: { applied_at: "desc" },
      take: limit,
      include: {
        opportunity: {
          select: {
            title: true, org_id: true, type: true, sport: true, status: true, posted_by_user_id: true,
            organization: { select: { org_name: true } },
          },
        },
      },
    });

    return rows.map(({ opportunity, ...r }) => ({
      ...r,
      opportunity_title: opportunity.title,
      opportunity_sport: opportunity.sport,
      opportunity_type: opportunity.type,
      org_id: opportunity.org_id,
      org_name: opportunity.organization.org_name,
      poster_user_id: opportunity.posted_by_user_id,
    })) as unknown as ApplicationRecord[];
  }

  async findManyByOpportunity(opportunityId: string): Promise<ApplicationRecord[]> {
    const rows = await this.db.application.findMany({
      where: { opportunity_id: opportunityId },
      orderBy: { applied_at: "desc" },
      include: {
        applicant: {
          select: {
            id: true,
            full_name: true,
            profile_photo_url: true,
            country: true,
            city: true,
            athlete_data: true,
            verification_status: true,
            verification_badges: true,
          },
        },
      },
    });

    return rows.map(({ applicant, ...r }) => ({
      ...r,
      applicant_name: applicant.full_name,
      applicant: {
        ...applicant,
        athlete: applicant.athlete_data,
        verification: {
          status: applicant.verification_status,
          badges: applicant.verification_badges,
        },
      },
    })) as unknown as ApplicationRecord[];
  }

  async create(data: CreateApplicationData): Promise<ApplicationRecord> {
    const [application] = await this.db.$transaction([
      this.db.application.create({
        data: {
          opportunity_id: data.opportunity_id,
          applicant_user_id: data.applicant_user_id,
          cover_note: data.cover_note,
          documents: data.documents ?? [],
          history: [
            { status: "pending", at: new Date(), by: data.applicant_user_id },
          ] as object[],
        },
      }),
      this.db.opportunity.update({
        where: { id: data.opportunity_id },
        data: { application_count: { increment: 1 } },
      }),
    ]);

    return application as unknown as ApplicationRecord;
  }

  async update(id: string, data: UpdateApplicationData): Promise<ApplicationRecord> {
    return this.db.application.update({
      where: { id },
      data,
    }) as unknown as ApplicationRecord;
  }
}
