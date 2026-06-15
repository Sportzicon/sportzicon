import { api } from "../api/client";
import { scoringApi } from "../api/scoringClient";
import { PostService } from "./post.service";
import { OpportunityService } from "./opportunity.service";
import { ApplicationService } from "./application.service";
import { BlogService } from "./blog.service";
import { CommentService } from "./comment.service";
import { MessageService } from "./message.service";
import { NotificationService } from "./notification.service";
import { UserService } from "./user.service";
import { AuthService } from "./auth.service";
import { OrganizationService } from "./organization.service";
import { ReelService } from "./reel.service";
import { SearchService } from "./search.service";
import { ScoringService } from "./scoring.service";
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

// ── Scoring backend service (uses a separate axios client — different base URL)
// scoringApi attaches the main Sportivox JWT, so no separate login is needed
// for read-only endpoints. Scorer-role writes go through the SSO session in
// useScoringAuthStore (managed by ScoringGate).
export const scoringService = build(new ScoringService(scoringApi), "ScoringService");

// ── Re-export classes for direct instantiation in tests ───────────────────────
export { PostService }         from "./post.service";
export { OpportunityService }  from "./opportunity.service";
export { ApplicationService }  from "./application.service";
export { BlogService }         from "./blog.service";
export { CommentService }      from "./comment.service";
export { MessageService }      from "./message.service";
export { NotificationService } from "./notification.service";
export { UserService }         from "./user.service";
export { AuthService }         from "./auth.service";
export { OrganizationService } from "./organization.service";
export { ReelService }         from "./reel.service";
export { SearchService }       from "./search.service";
export { ScoringService }      from "./scoring.service";

// ── Re-export decorators so callers can compose their own stacks ──────────────
export { withLogging } from "./decorators/withLogging";
export { withRetry }   from "./decorators/withRetry";

export type { LoginRequest, LoginResponse } from "./auth.service";
export type { CreateReelRequest, UpdateReelRequest } from "./reel.service";
export type { SearchMode, SearchParams, SearchPage, PlayerSearchParams, ClubSearchParams, OpportunitySearchParams } from "./search.service";
export type { ScoringMatch, ScoringTournament, ScoringBall, ScoringPlayerStats, CreateTournamentRequest, CreateMatchRequest, AddBallRequest } from "./scoring.service";
