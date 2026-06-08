import { repositories } from "../../repositories";
import { logger } from "../../config/logger";
import { sendMail } from "../../config/mailer";

export async function createNotification(input: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
}) {
  const notification = await repositories.notification.create({
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
  });

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

export async function listForUser(userId: string, limit = 50, unreadOnly = false) {
  return repositories.notification.findManyByUser(userId, limit, unreadOnly);
}

export async function countUnread(userId: string) {
  return repositories.notification.countUnread(userId);
}

export async function markRead(userId: string, ids: string[]) {
  return repositories.notification.markRead(userId, ids.length ? ids : undefined);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
