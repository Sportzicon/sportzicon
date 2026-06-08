import type { PrismaClient } from "@prisma/client";
import type {
  IOpportunityRepository,
  OpportunityRecord,
  OpportunityFilters,
  CreateOpportunityData,
} from "../interfaces/IOpportunityRepository";
import type { OpportunityStatus } from "../../types/domain";

export class PrismaOpportunityRepository implements IOpportunityRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<OpportunityRecord | null> {
    return this.db.opportunity.findUnique({ where: { id } }) as Promise<OpportunityRecord | null>;
  }

  async findMany(filters: OpportunityFilters): Promise<OpportunityRecord[]> {
    // Cast where clause to any — our OpportunityFilters uses `string` for `type`
    // but Prisma expects the OpportunityType enum. The values are the same strings;
    // this avoids coupling the repository interface to a generated Prisma type.
    const where: any = {};
    if (filters.status)  where.status  = filters.status;
    if (filters.sport)   where.sport   = filters.sport;
    if (filters.type)    where.type    = filters.type;
    if (filters.country) where.country = filters.country;
    if (filters.city)    where.city    = filters.city;
    if (filters.org_id)  where.org_id  = filters.org_id;

    return this.db.opportunity.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit ?? 50,
    }) as unknown as OpportunityRecord[];
  }

  async create(data: CreateOpportunityData): Promise<OpportunityRecord> {
    // Prisma schema has a `title_lower` indexed field for case-insensitive search.
    // Derive it here so callers don't need to know about it.
    return this.db.opportunity.create({
      data: {
        ...(data as any),
        title_lower: data.title.toLowerCase(),
      },
    }) as unknown as OpportunityRecord;
  }

  async update(id: string, data: Partial<OpportunityRecord>): Promise<OpportunityRecord> {
    // Cast to any — OpportunityRecord uses plain scalars, but Prisma update input
    // uses relational update shapes. The field names and values are compatible.
    return this.db.opportunity.update({
      where: { id },
      data: data as any,
    }) as unknown as OpportunityRecord;
  }

  async delete(id: string): Promise<void> {
    await this.db.opportunity.delete({ where: { id } });
  }

  async incrementApplicationCount(id: string, delta = 1): Promise<void> {
    await this.db.opportunity.update({
      where: { id },
      data: { application_count: { increment: delta } },
    });
  }

  async updateStatus(id: string, status: OpportunityStatus): Promise<void> {
    await this.db.opportunity.update({ where: { id }, data: { status } });
  }

  async updateVacanciesFilled(id: string, delta: number): Promise<OpportunityRecord> {
    return this.db.opportunity.update({
      where: { id },
      data: { vacancies_filled: { increment: delta } },
    }) as unknown as OpportunityRecord;
  }
}
