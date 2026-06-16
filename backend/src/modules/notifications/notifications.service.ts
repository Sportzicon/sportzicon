import { repositories } from "../../repositories";
import { logger } from "../../config/logger";
import { sendMail } from "../../config/mailer";
import { cacheGet, cacheSet, cacheDel } from "../../config/redis";

export async function createNotification(input: {
  user_id: string;
  actor_id?: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
}) {
  const notification = await repositories.notification.create({
    user_id: input.user_id,
    actor_id: input.actor_id,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
  });

  // Invalidate unread count cache for the recipient
  await cacheDel(`notif:count:${input.user_id}`);

  if (input.email) {
    try {
      const user = await repositories.user.findById(input.user_id, { email: true, full_name: true });
      if (user) {
        await sendMail({
          to: (user as any).email,
          subject: input.title,
          html: `<p>Hi ${escapeHtml((user as any).full_name)},</p><p>${escapeHtml(input.body)}</p>`,
          user_id: input.user_id,
          email_type: "notification"
        });
      }
    } catch (err) {
      logger.warn({ err }, "notification email failed");
    }
  }

  return notification;
}

export async function listForUser(userId: string, limit = 20, cursor?: string) {
  return repositories.notification.findManyByUser(userId, limit, cursor);
}

export async function countUnread(userId: string) {
  const key = `notif:count:${userId}`;
  const cached = await cacheGet(key);
  if (cached !== null) return JSON.parse(cached) as number;

  const count = await repositories.notification.countUnread(userId);
  await cacheSet(key, JSON.stringify(count), 30);
  return count;
}

export async function markRead(userId: string, ids: string[]) {
  const result = await repositories.notification.markRead(userId, ids.length ? ids : undefined);
  await cacheDel(`notif:count:${userId}`);
  return result;
}

export async function markOneRead(userId: string, id: string) {
  const result = await repositories.notification.markOneRead(userId, id);
  await cacheDel(`notif:count:${userId}`);
  return result;
}

export async function deleteOldNotifications(): Promise<number> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const deleted = await repositories.notification.deleteOlderThan(cutoff);
  if (deleted > 0) logger.info({ deleted }, "cleaned up old notifications");
  return deleted;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
