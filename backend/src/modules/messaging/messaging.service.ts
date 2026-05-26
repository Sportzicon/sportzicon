import { FieldValue } from "@google-cloud/firestore";
import { db, Collections } from "../../config/firestore";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { newId, now, pairId } from "../../utils/ids";
import { createNotification } from "../notifications/notifications.service";
import type { ConversationDoc, MessageDoc, UserDoc } from "../../types/domain";

export async function sendMessage(senderId: string, recipientId: string, body: string) {
  if (senderId === recipientId) throw BadRequest("Cannot message yourself");
  if (!body.trim()) throw BadRequest("Message body cannot be empty");

  const [senderSnap, recipientSnap] = await Promise.all([
    db.collection(Collections.users).doc(senderId).get(),
    db.collection(Collections.users).doc(recipientId).get()
  ]);
  if (!senderSnap.exists) throw NotFound("Sender not found");
  if (!recipientSnap.exists) throw NotFound("Recipient not found");
  const sender = senderSnap.data() as UserDoc;
  const recipient = recipientSnap.data() as UserDoc;
  if (recipient.status === "suspended") throw Forbidden("Recipient cannot receive messages");

  const convId = pairId(senderId, recipientId);
  const convRef = db.collection(Collections.conversations).doc(convId);
  const msgId = newId();
  const msgRef = db.collection(Collections.messages).doc(msgId);

  await db.runTransaction(async (tx) => {
    const convSnap = await tx.get(convRef);
    const msg: MessageDoc = {
      id: msgId,
      conversation_id: convId,
      sender_id: senderId,
      recipient_id: recipientId,
      body,
      created_at: now()
    };
    tx.set(msgRef, msg);
    if (!convSnap.exists) {
      const conv: ConversationDoc = {
        id: convId,
        participant_ids: [senderId, recipientId],
        last_message: { body, sender_id: senderId, at: now() },
        unread_counts: { [senderId]: 0, [recipientId]: 1 },
        created_at: now(),
        updated_at: now()
      };
      tx.set(convRef, conv);
    } else {
      tx.update(convRef, {
        last_message: { body, sender_id: senderId, at: now() },
        [`unread_counts.${recipientId}`]: FieldValue.increment(1),
        updated_at: now()
      });
    }
  });

  await createNotification({
    user_id: recipientId,
    type: "new_message",
    title: `New message from ${sender.full_name}`,
    body: body.length > 120 ? body.slice(0, 117) + "..." : body,
    link: `/messages/${convId}`,
    email: true
  });

  return { conversation_id: convId, id: msgId };
}

export async function listConversations(userId: string, limit = 50) {
  const snap = await db
    .collection(Collections.conversations)
    .where("participant_ids", "array-contains", userId)
    .orderBy("updated_at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as ConversationDoc);
}

export async function listMessages(userId: string, conversationId: string, limit = 50, cursor?: string) {
  const convSnap = await db.collection(Collections.conversations).doc(conversationId).get();
  if (!convSnap.exists) throw NotFound("Conversation not found");
  const conv = convSnap.data() as ConversationDoc;
  if (!conv.participant_ids.includes(userId)) throw Forbidden("Not a participant");
  let q = db
    .collection(Collections.messages)
    .where("conversation_id", "==", conversationId)
    .orderBy("created_at", "desc")
    .limit(limit);
  if (cursor) q = q.startAfter(Number(cursor));
  const snap = await q.get();
  const items = snap.docs.map((d) => d.data() as MessageDoc);
  const next_cursor = snap.docs.length === limit ? String(snap.docs[snap.docs.length - 1].get("created_at")) : null;
  return { items: items.reverse(), next_cursor };
}

export async function markRead(userId: string, conversationId: string) {
  const convRef = db.collection(Collections.conversations).doc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw NotFound("Conversation not found");
  const conv = convSnap.data() as ConversationDoc;
  if (!conv.participant_ids.includes(userId)) throw Forbidden("Not a participant");
  await convRef.update({ [`unread_counts.${userId}`]: 0, updated_at: now() });
  return { ok: true };
}
