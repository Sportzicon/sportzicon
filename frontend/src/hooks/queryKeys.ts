import type { OpportunityFilters, BlogFilters } from "../models";

/**
 * Single source of truth for all React Query cache keys.
 * Every useQuery and invalidateQueries call must reference these — no raw strings.
 */
export const queryKeys = {
  // Feed / Posts
  feed:           (limit?: number) => limit ? ["feed", limit] : ["feed"] as const,

  // Opportunities
  opportunities:  (filters?: OpportunityFilters) => ["opportunities", filters ?? {}] as const,
  opportunity:    (id: string) => ["opportunity", id] as const,
  myOrgs:         () => ["my-orgs"] as const,

  // Applications
  myApplications: () => ["applications", "mine"] as const,
  applicants:     (opportunityId: string) => ["applicants", opportunityId] as const,

  // Blogs
  blogs:          (filters?: BlogFilters) => ["blogs", filters ?? {}] as const,
  blog:           (id: string) => ["blog", id] as const,

  // Reels
  reels:          () => ["reels"] as const,

  // Messages
  conversations:  () => ["conversations"] as const,
  messages:       (conversationId: string) => ["messages", conversationId] as const,

  // Notifications
  notifCount:     () => ["notifications", "count"] as const,
  notifications:  () => ["notifications", "list"] as const,

  // Users
  user:           (id: string) => ["user", id] as const,

  // Comments
  comments:       (parentType: string, parentId: string) => ["comments", parentType, parentId] as const,

  // Search
  search:         (mode: string, params: Record<string, unknown>) => ["search", mode, params] as const,
} as const;
