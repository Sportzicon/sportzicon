import { db, Collections } from "../../config/firestore";
import { logger } from "../../config/logger";
import { newId, now } from "../../utils/ids";
import { sendMail } from "../../config/mailer";
import type { NotificationDoc, UserDoc } from "../../types/domain";

export async function createNotification(input: {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
}) {
  const id = newId();
  const doc: NotificationDoc = {
    id,
    user_id: input.user_id,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    read: false,
    created_at: now()
  };
  await db.collection(Collections.notifications).doc(id).set(doc);

  if (input.email) {
    try {
      const userSnap = await db.collection(Collections.users).doc(input.user_id).get();
      if (userSnap.exists) {
        const user = userSnap.data() as UserDoc;
        await sendMail({
          to: user.email,
          subject: input.title,
          html: `<p>Hi ${escapeHtml(user.full_name)},</p><p>${escapeHtml(input.body)}</p>`
        });
      }
    } catch (err) {
      // Reliability: in-app notification has already been created; log and continue.
      logger.warn({ err }, "notification email failed");
    }
  }
  return doc;
}

export async function listForUser(userId: string, limit = 50, unreadOnly = false) {
  let q = db
    .collection(Collections.notifications)
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(limit);
  if (unreadOnly) {
    q = db
      .collection(Collections.notifications)
      .where("user_id", "==", userId)
      .where("read", "==", false)
      .orderBy("created_at", "desc")
      .limit(limit);
  }
  const snap = await q.get();
  return snap.docs.map((d) => d.data() as NotificationDoc);
}

export async function countUnread(userId: string) {
  const snap = await db
    .collection(Collections.notifications)
    .where("user_id", "==", userId)
    .where("read", "==", false)
    .count()
    .get();
  return snap.data().count;
}

export async function markRead(userId: string, ids: string[]) {
  if (ids.length === 0) {
    // Mark all
    const snap = await db
      .collection(Collections.notifications)
      .where("user_id", "==", userId)
      .where("read", "==", false)
      .limit(500)
      .get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
    return { updated: snap.size };
  }
  const batch = db.batch();
  let updated = 0;
  for (const id of ids) {
    const ref = db.collection(Collections.notifications).doc(id);
    batch.update(ref, { read: true });
    updated++;
  }
  await batch.commit();
  return { updated };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
}
