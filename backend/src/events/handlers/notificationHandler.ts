import { eventBus } from "../../lib/EventBus";
import { createNotification } from "../../modules/notifications/notifications.service";
import { APPLICATION_NOTIFICATIONS } from "../../workflows/applicationWorkflow";
import {
  APP_APPLIED,
  APP_TRANSITIONED,
  USER_FOLLOWED,
  MESSAGE_SENT,
  CONTENT_LIKED,
  GUARDIAN_CONSENT_APPROVED,
  DOC_ACCESS_REQUESTED,
  DOC_ACCESS_DECIDED,
  type ApplicationAppliedEvent,
  type ApplicationTransitionedEvent,
  type UserFollowedEvent,
  type MessageSentEvent,
  type ContentLikedEvent,
  type GuardianConsentApprovedEvent,
  type DocumentAccessRequestedEvent,
  type DocumentAccessDecidedEvent,
} from "../types";

const CONTENT_LINK: Record<ContentLikedEvent["contentType"], (id: string) => string> = {
  post: () => `/feed`,
  blog: (id) => `/blogs/${id}`,
  reel: () => `/reels`,
};

/**
 * Registers all notification-related event handlers on the shared event bus.
 * Call once at application startup (before the HTTP server starts accepting requests).
 */
export function registerNotificationHandlers(): void {

  // ── New application submitted ──────────────────────────────────────────────
  eventBus.on<ApplicationAppliedEvent>(APP_APPLIED, async (e) => {
    await createNotification({
      user_id: e.posterId,
      actor_id: e.applicantId,
      type: "new_application",
      title: "New application received",
      body: `${e.applicantName} applied to "${e.opportunityTitle}".`,
      link: `/opportunities/${e.opportunityId}/applicants`,
      email: true,
    });
  });

  // ── Application status transitioned ───────────────────────────────────────
  eventBus.on<ApplicationTransitionedEvent>(APP_TRANSITIONED, async (e) => {
    const notif = APPLICATION_NOTIFICATIONS[e.to];
    if (!notif) return;

    await createNotification({
      user_id: e.applicantId,
      actor_id: e.actorId,
      type: `application_${e.to}`,
      title: notif.title,
      body: notif.bodyTemplate(e.opportunityTitle, e.reason),
      link: `/opportunities/${e.opportunityId}`,
      email: notif.email,
    });
  });

  // ── New follower ───────────────────────────────────────────────────────────
  eventBus.on<UserFollowedEvent>(USER_FOLLOWED, async (e) => {
    await createNotification({
      user_id: e.followeeId,
      actor_id: e.followerId,
      type: "new_follower",
      title: "New follower",
      body: `${e.followerName} started following you.`,
      link: `/profile/${e.followerId}`,
      email: false,
    });
  });

  // ── New message received ───────────────────────────────────────────────────
  eventBus.on<MessageSentEvent>(MESSAGE_SENT, async (e) => {
    await createNotification({
      user_id: e.recipientId,
      actor_id: e.senderId,
      type: "new_message",
      title: "New message",
      body: `${e.senderName}: ${e.bodyPreview}`,
      link: `/messages?to=${e.senderId}`,
      email: true,
    });
  });

  // ── Content liked (post/blog/reel) ────────────────────────────────────────
  eventBus.on<ContentLikedEvent>(CONTENT_LIKED, async (e) => {
    await createNotification({
      user_id: e.authorId,
      actor_id: e.actorId,
      type: `${e.contentType}_liked`,
      title: `Someone liked your ${e.contentType}`,
      body: `${e.actorName} liked your ${e.contentType}.`,
      link: CONTENT_LINK[e.contentType](e.contentId),
      email: false,
    });
  });

  // ── Guardian consent approved ─────────────────────────────────────────────
  eventBus.on<GuardianConsentApprovedEvent>(GUARDIAN_CONSENT_APPROVED, async (e) => {
    await createNotification({
      user_id: e.userId,
      type: "guardian_consent_approved",
      title: "Guardian consent approved",
      body: "Your guardian approved your account. Clubs, scouts, and organizers can now message you.",
      link: "/dashboard",
      email: false,
    });
  });

  // ── Document access requested ─────────────────────────────────────────────
  eventBus.on<DocumentAccessRequestedEvent>(DOC_ACCESS_REQUESTED, async (e) => {
    await createNotification({
      user_id: e.athleteId,
      actor_id: e.requesterId,
      type: "doc_access_requested",
      title: "New document access request",
      body: `${e.requesterName} requested access to your profile documents.`,
      link: "/profile/document-access",
      email: true,
    });
  });

  // ── Document access decided (approved / rejected / revoked) ──────────────
  eventBus.on<DocumentAccessDecidedEvent>(DOC_ACCESS_DECIDED, async (e) => {
    const copy: Record<DocumentAccessDecidedEvent["status"], { title: string; body: string }> = {
      approved: {
        title: "Document access granted",
        body: "Your document access request was approved.",
      },
      rejected: {
        title: "Document access request declined",
        body: "Your document access request was not approved.",
      },
      revoked: {
        title: "Document access revoked",
        body: "Your access to this athlete's documents has been revoked.",
      },
    };
    await createNotification({
      user_id: e.requesterId,
      actor_id: e.actorId,
      type: `doc_access_${e.status}`,
      title: copy[e.status].title,
      body: copy[e.status].body,
      link: `/profile/${e.athleteId}`,
      email: e.status === "approved",
    });
  });
}
