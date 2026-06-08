import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { eventBus } from "../../lib/EventBus";
import { MESSAGE_SENT, type MessageSentEvent } from "../../events/types";

export async function sendMessage(senderId: string, recipientId: string, body: string) {
  if (senderId === recipientId) throw BadRequest("Cannot message yourself");
  if (!body.trim()) throw BadRequest("Message body cannot be empty");

  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { id: true, full_name: true } }),
    prisma.user.findUnique({ where: { id: recipientId }, select: { id: true, status: true } })
  ]);
  if (!sender)    throw NotFound("Sender not found");
  if (!recipient) throw NotFound("Recipient not found");
  if (recipient.status === "suspended") throw Forbidden("Recipient cannot receive messages");

  let conversation = await prisma.conversation.findFirst({
    where: { participant_ids: { hasEvery: [senderId, recipientId] } },
    select: { id: true, unread_counts: true }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        participant_ids: [senderId, recipientId],
        last_message: { body, sender_id: senderId, at: new Date() },
        unread_counts: { [senderId]: 0, [recipientId]: 1 }
      },
      select: { id: true, unread_counts: true }
    });
  } else {
    const counts = (conversation.unread_counts as Record<string, number>) ?? {};
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        last_message: { body, sender_id: senderId, at: new Date() },
        unread_counts: { ...counts, [recipientId]: (counts[recipientId] ?? 0) + 1 }
      }
    });
  }

  const message = await prisma.message.create({
    data: { conversation_id: conversation.id, sender_id: senderId, recipient_id: recipientId, body }
  });

  eventBus.emit<MessageSentEvent>(MESSAGE_SENT, {
    messageId: message.id,
    senderId,
    senderName: sender.full_name,
    recipientId,
    conversationId: conversation.id,
    bodyPreview: body.length > 120 ? body.slice(0, 117) + "..." : body,
  });

  return { conversation_id: conversation.id, id: message.id };
}

export async function listConversations(userId: string, limit = 50) {
  const convs = await prisma.conversation.findMany({
    where: { participant_ids: { has: userId } },
    orderBy: { updated_at: "desc" },
    take: limit
  });

  const otherIds = [...new Set(
    convs.flatMap((c) => c.participant_ids.filter((p) => p !== userId))
  )];

  const users = otherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, full_name: true, role: true }
      })
    : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return convs.map((c) => {
    const otherId = c.participant_ids.find((p) => p !== userId);
    const other   = otherId ? userMap[otherId] : null;
    return { ...c, _other_name: other?.full_name ?? null, _other_sub: other?.role ?? null };
  });
}

export async function listMessages(userId: string, conversationId: string, limit = 50, cursor?: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant_ids: true }
  });
  if (!conv) throw NotFound("Conversation not found");
  if (!conv.participant_ids.includes(userId)) throw Forbidden("Not a participant");

  const items = await prisma.message.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  const hasMore = items.length > limit;
  const page    = hasMore ? items.slice(0, limit) : items;
  return { items: page.reverse(), next_cursor: hasMore ? page[page.length - 1].id : null };
}

export async function markRead(userId: string, conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant_ids: true, unread_counts: true }
  });
  if (!conv) throw NotFound("Conversation not found");
  if (!conv.participant_ids.includes(userId)) throw Forbidden("Not a participant");

  const counts = (conv.unread_counts as Record<string, number>) ?? {};
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unread_counts: { ...counts, [userId]: 0 } }
  });
  return { ok: true };
}
