import { api } from "../api/client";
import { scoringApi } from "../api/scoringClient";
import { PostService } from "../modules/feed/services/post.service";
import { OpportunityService } from "../modules/opportunities/services/opportunity.service";
import { ApplicationService } from "../modules/applications/services/application.service";
import { BlogService } from "../modules/blogs/services/blog.service";
import { CommentService } from "../modules/comments/services/comment.service";
import { MessageService } from "../modules/messaging/services/message.service";
import { NotificationService } from "../modules/notifications/services/notification.service";
import { UserService } from "../modules/profile/services/user.service";
import { AuthService } from "../modules/auth/services/auth.service";
import { OrganizationService } from "../modules/organizations/services/organization.service";
import { ReelService } from "../modules/reels/services/reel.service";
import { SearchService } from "../modules/search/services/search.service";
import { ScoringService } from "../modules/live-scoring/services/scoring.service";
import { TournamentService } from "../modules/tournaments/services/tournament.service";
import { DocumentAccessService } from "../modules/documentAccess/services/documentAccess.service";
import { withLogging } from "./decorators/withLogging";
import { withRetry } from "./decorators/withRetry";

/**
 * Compose decorators: withRetry wraps the raw service, withLogging wraps the retry layer.
 * Call order on a method: Logging (entry) → Retry → actual HTTP call → Retry (on fail) → Logging (exit).
 *
 * Swap the AxiosInstance in tests:
 *   const testService = new PostService(mockAxios);
 */
function build<T extends object>(instance: T, name: string): T {
  return withLogging(withRetry(instance, { retries: 2 }), name);
}

// ── Main API services (all share the authenticated `api` client) ──────────────
export const postService         = build(new PostService(api),         "PostService");
export const opportunityService  = build(new OpportunityService(api),  "OpportunityService");
export const applicationService  = build(new ApplicationService(api),  "ApplicationService");
export const blogService         = build(new BlogService(api),         "BlogService");
export const commentService      = build(new CommentService(api),      "CommentService");
export const messageService      = build(new MessageService(api),      "MessageService");
export const notificationService = build(new NotificationService(api), "NotificationService");
export const userService         = build(new UserService(api),         "UserService");
export const authService         = withLogging(new AuthService(api),         "AuthService");
export const organizationService = build(new OrganizationService(api), "OrganizationService");
export const reelService         = build(new ReelService(api),         "ReelService");
export const searchService       = build(new SearchService(api),       "SearchService");
export const tournamentService   = build(new TournamentService(api),   "TournamentService");
export const documentAccessService = build(new DocumentAccessService(api), "DocumentAccessService");

// ── Scoring backend service (uses a separate axios client — different base URL)
// scoringApi attaches the main Sportivox JWT, so no separate login is needed
// for read-only endpoints. Scorer-role writes go through the SSO session in
// useScoringAuthStore (managed by ScoringGate).
export const scoringService = build(new ScoringService(scoringApi), "ScoringService");

// ── Re-export classes for direct instantiation in tests ───────────────────────
export { PostService }         from "../modules/feed/services/post.service";
export { OpportunityService }  from "../modules/opportunities/services/opportunity.service";
export { ApplicationService }  from "../modules/applications/services/application.service";
export { BlogService }         from "../modules/blogs/services/blog.service";
export { CommentService }      from "../modules/comments/services/comment.service";
export { MessageService }      from "../modules/messaging/services/message.service";
export { NotificationService } from "../modules/notifications/services/notification.service";
export { UserService }         from "../modules/profile/services/user.service";
export { AuthService }         from "../modules/auth/services/auth.service";
export { OrganizationService } from "../modules/organizations/services/organization.service";
export { ReelService }         from "../modules/reels/services/reel.service";
export { SearchService }       from "../modules/search/services/search.service";
export { ScoringService }      from "../modules/live-scoring/services/scoring.service";
export { TournamentService }   from "../modules/tournaments/services/tournament.service";
export { DocumentAccessService } from "../modules/documentAccess/services/documentAccess.service";

// ── Re-export decorators so callers can compose their own stacks ──────────────
export { withLogging } from "./decorators/withLogging";
export { withRetry }   from "./decorators/withRetry";

export type { LoginRequest, LoginResponse } from "../modules/auth/services/auth.service";
export type { CreateReelRequest, UpdateReelRequest } from "../modules/reels/services/reel.service";
export type { SearchMode, SearchParams, SearchPage, PlayerSearchParams, ClubSearchParams, OpportunitySearchParams } from "../modules/search/services/search.service";
export type { ScoringMatch, ScoringTournament, ScoringBall, ScoringPlayerStats, CreateTournamentRequest, CreateMatchRequest, AddBallRequest } from "../modules/live-scoring/services/scoring.service";
