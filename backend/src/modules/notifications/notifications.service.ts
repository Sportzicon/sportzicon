import { prisma } from "../../config/prisma";
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
  const notification = await prisma.notification.create({
    data: {
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link
    }
  });

  if (input.email) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: input.user_id },
        select: { email: true, full_name: true }
      });
      if (user) {
        await sendMail({
          to: user.email,
          subject: input.title,
          html: `<p>Hi ${escapeHtml(user.full_name)},</p><p>${escapeHtml(input.body)}</p>`,
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
  return prisma.notification.findMany({
    where: { user_id: userId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { created_at: "desc" },
    take: limit
  });
}

export async function countUnread(userId: string) {
  return prisma.notification.count({ where: { user_id: userId, read: false } });
}

export async function markRead(userId: string, ids: string[]) {
  if (ids.length === 0) {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true }
    });
    return { updated: result.count };
  }
  const result = await prisma.notification.updateMany({
    where: { id: { in: ids }, user_id: userId },
    data: { read: true }
  });
  return { updated: result.count };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
