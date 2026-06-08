import { prisma } from "../config/prisma";
import { PrismaApplicationRepository } from "./prisma/PrismaApplicationRepository";
import { PrismaOpportunityRepository } from "./prisma/PrismaOpportunityRepository";
import { PrismaNotificationRepository } from "./prisma/PrismaNotificationRepository";
import { PrismaUserRepository } from "./prisma/PrismaUserRepository";

/**
 * Singleton repository instances wired to the shared Prisma client.
 * Swap these in tests with mock implementations of the matching interface.
 *
 * Example (Jest):
 *   import { repositories } from "../../repositories";
 *   repositories.application = createMockApplicationRepository();
 */
export const repositories = {
  application:  new PrismaApplicationRepository(prisma),
  opportunity:  new PrismaOpportunityRepository(prisma),
  notification: new PrismaNotificationRepository(prisma),
  user:         new PrismaUserRepository(prisma),
};

export type Repositories = typeof repositories;

// Re-export interfaces for consumers
export type { IApplicationRepository }  from "./interfaces/IApplicationRepository";
export type { IOpportunityRepository }  from "./interfaces/IOpportunityRepository";
export type { INotificationRepository } from "./interfaces/INotificationRepository";
export type { IUserRepository }         from "./interfaces/IUserRepository";
