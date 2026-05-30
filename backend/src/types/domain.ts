// Lightweight domain constants used outside the database layer (JWT payloads,
// middleware, route guards). All database-shape types come from the Prisma
// generated client — import those directly from "@prisma/client".

export type Role = "athlete" | "club" | "scout" | "organizer" | "admin";
export const ROLES: Role[] = ["athlete", "club", "scout", "organizer", "admin"];

export type AccountStatus = "active" | "suspended" | "pending";
export type ApplicationStatus = "pending" | "shortlisted" | "selected" | "rejected" | "withdrawn";
export type OpportunityType = "trial" | "recruitment" | "scholarship" | "tournament" | "coaching_job";
export type OpportunityStatus = "open" | "closed" | "filled";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type EntityType = "user" | "organization";
export type ReportStatus = "open" | "actioned" | "dismissed";
