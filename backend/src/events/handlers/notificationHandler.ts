import { eventBus } from "../../lib/EventBus";
import { createNotification } from "../../modules/notifications/notifications.service";
import { APPLICATION_NOTIFICATIONS } from "../../workflows/applicationWorkflow";
import {
  APP_APPLIED,
  APP_TRANSITIONED,
  USER_FOLLOWED,
  MESSAGE_SENT,
  CONTENT_LIKED,
  type ApplicationAppliedEvent,
  type ApplicationTransitionedEvent,
  type UserFollowedEvent,
  type MessageSentEvent,
  type ContentLikedEvent,
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
}
