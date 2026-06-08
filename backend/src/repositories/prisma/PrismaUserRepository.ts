import type { PrismaClient } from "@prisma/client";
import type { IUserRepository, UserRecord } from "../interfaces/IUserRepository";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string, select?: Record<string, boolean>): Promise<UserRecord | null> {
    return this.db.user.findUnique({
      where: { id },
      ...(select ? { select } : {}),
    }) as Promise<UserRecord | null>;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { email } }) as Promise<UserRecord | null>;
  }

  async updateAthleteData(userId: string, data: Record<string, unknown>): Promise<void> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { athlete_data: true },
    });

    // Merge existing JSON with the incoming patch, then cast to Prisma's InputJsonValue.
    const merged = Object.assign({}, user?.athlete_data ?? {}, data);

    await this.db.user.update({
      where: { id: userId },
      data: { athlete_data: merged as any },
    });
  }
}
