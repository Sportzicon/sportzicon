import type { OpportunityFilters, BlogFilters } from "../models";

/**
 * Single source of truth for all React Query cache keys.
 * Every useQuery and invalidateQueries call must reference these — no raw strings.
 */
export const queryKeys = {
  // Feed / Posts
  feed:           (limit?: number) => limit ? ["feed", limit] : ["feed"] as const,
  feedInfinite:   () => ["feed", "infinite"] as const,

  // Opportunities
  opportunities:  (filters?: OpportunityFilters) => ["opportunities", filters ?? {}] as const,
  opportunitiesInfinite: (filters?: OpportunityFilters) => ["opportunities", "infinite", filters ?? {}] as const,
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

  // Organizations
  organizations:  (filters?: Record<string, unknown>) => ["organizations", filters ?? {}] as const,
  organization:   (id: string) => ["organization", id] as const,
  orgDocuments:   (id: string) => ["organization", id, "documents"] as const,
  myOrganizations: () => ["my-orgs"] as const,
  adminVerifications: () => ["admin-verifs"] as const,

  // Users / Profile
  user:            (id: string) => ["user", id] as const,
  userPosts:       (id: string) => ["user-posts", id] as const,
  userReels:       (id: string) => ["user-reels", id] as const,
  userDocs:        (id: string) => ["user-docs", id] as const,
  followStatus:    (id: string) => ["follow-status", id] as const,
  followers:       (id: string) => ["followers", id] as const,
  following:       (id: string) => ["following", id] as const,
  emailLogs:       (id: string) => ["email-logs", id] as const,
  cricketStatsByUser: (id: string) => ["cricket-stats-by-user", id] as const,

  // Comments
  comments:       (parentType: string, parentId: string) => ["comments", parentType, parentId] as const,

  // Search
  search:         (mode: string, params: Record<string, unknown>) => ["search", mode, params] as const,

  // Admin
  adminUsers:         (filters?: Record<string, unknown>) => ["admin", "users", filters ?? {}] as const,
  adminUserDetail:    (id: string) => ["admin", "user-detail", id] as const,
  adminReports:       (filters?: Record<string, unknown>) => ["admin", "reports", filters ?? {}] as const,
  adminAuditLog:      (filters?: Record<string, unknown>) => ["admin", "audit-log", filters ?? {}] as const,
  adminAnalytics:     () => ["admin", "analytics"] as const,
  adminOpportunities: (filters?: Record<string, unknown>) => ["admin", "opportunities", filters ?? {}] as const,
  adminOrganizations: (filters?: Record<string, unknown>) => ["admin", "organizations", filters ?? {}] as const,
  adminApplications:  (filters?: Record<string, unknown>) => ["admin", "applications", filters ?? {}] as const,

  // Tournaments
  tournaments:    (filters?: Record<string, unknown>) => ["tournaments", filters ?? {}] as const,
  tournament:     (id: string) => ["tournament", id] as const,

  // Org sub-resources
  orgOpportunities: (orgId: string) => ["org-opps", orgId] as const,

  // Live scores (public, no auth)
  liveMatches:        () => ["live-matches-public"] as const,
  upcomingMatches:    () => ["upcoming-matches-public"] as const,
  recentMatches:      () => ["recent-matches-public"] as const,
  allMatchesByStatus: (status: string) => ["all-matches-public", status] as const,
  liveMatchDetail:    (id: string) => ["live-match-detail", id] as const,
  liveBalls:          (innId: string) => ["live-balls", innId] as const,

  // Scoring subsystem (separate auth context)
  scoringLive:                  () => ["scoring-live"] as const,
  scoringInningsAnalytics:      (innId: string) => ["scoring-innings-analytics", innId] as const,
  scoringTournaments:           (filters?: Record<string, unknown>) => ["scoring-tournaments", filters ?? {}] as const,
  scoringTournament:            (id: string) => ["scoring-tournament", id] as const,
  scoringMatch:                 (id: string) => ["scoring-match", id] as const,
  scoringMatchLive:             (id: string) => ["scoring-match-live", id] as const,
  scoringXi:                    (matchId: string) => ["scoring-xi", matchId] as const,
  scoringXiLive:                (matchId: string) => ["scoring-xi-live", matchId] as const,
  scoringBallsLive:             (innId: string) => ["scoring-balls-live", innId] as const,
  scoringRetiredHurt:           (innId: string) => ["scoring-retired-hurt", innId] as const,
  scoringInningsPartnerships:   (innId: string) => ["scoring-innings-partnerships", innId] as const,
  scoringStandings:             (tournamentId: string) => ["scoring-standings", tournamentId] as const,
  cricketAthletes:              () => ["cricket-athletes"] as const,
} as const;
