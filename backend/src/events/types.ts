import type { ApplicationStatus, OpportunityStatus } from "../types/domain";

// ── Application events ───────────────────────────────────────────────────────

export const APP_APPLIED = "application.applied";
export const APP_TRANSITIONED = "application.transitioned";

export interface ApplicationAppliedEvent {
  applicationId: string;
  applicantId: string;
  applicantName: string;
  opportunityId: string;
  opportunityTitle: string;
  posterId: string;
}

export interface ApplicationTransitionedEvent {
  applicationId: string;
  applicantId: string;
  opportunityId: string;
  opportunityTitle: string;
  from: ApplicationStatus;
  to: ApplicationStatus;
  reason?: string;
  /** actor who triggered the transition */
  actorId: string;
}

// ── Opportunity events ───────────────────────────────────────────────────────

export const OPP_STATUS_CHANGED = "opportunity.statusChanged";

export interface OpportunityStatusChangedEvent {
  opportunityId: string;
  opportunityTitle: string;
  from: OpportunityStatus;
  to: OpportunityStatus;
  posterId: string;
}

// ── Post events ──────────────────────────────────────────────────────────────

export const POST_LIKED = "post.liked";

export interface PostLikedEvent {
  postId: string;
  actorId: string;
  actorName: string;
  authorId: string;
}

// ── Follow events ────────────────────────────────────────────────────────────

export const USER_FOLLOWED = "user.followed";

export interface UserFollowedEvent {
  followerId: string;
  followerName: string;
  followeeId: string;
}

// ── Message events ───────────────────────────────────────────────────────────

export const MESSAGE_SENT = "message.sent";

export interface MessageSentEvent {
  messageId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  conversationId: string;
  bodyPreview: string;
}
