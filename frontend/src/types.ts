// Backward-compatibility shim. All types now live in src/models/.
// Import directly from "../models" in new code; this file keeps old imports working.
export type { Role, User, UpdateAthleteRequest } from "./models/user.model";
export type { Organization } from "./models/organization.model";
export type {
  Opportunity,
  OpportunityFilters,
  CreateOpportunityRequest,
  UpdateOpportunityRequest,
  ApplyRequest,
} from "./models/opportunity.model";
export type { ApplicationStatus, ApplicationHistoryEntry, Application } from "./models/application.model";
export type { PostAuthor, Post, CreatePostRequest, UpdatePostRequest } from "./models/post.model";
export type { ReelAuthor, Reel } from "./models/reel.model";
export type { Blog, BlogFilters } from "./models/blog.model";
export type { Notification } from "./models/notification.model";
export type { CommentParentType, CommentDoc, AddCommentRequest, UpdateCommentRequest } from "./models/comment.model";
export type { Message, Conversation, SendMessageRequest } from "./models/message.model";
