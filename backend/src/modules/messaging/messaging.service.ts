import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { eventBus } from "../../lib/EventBus";
import { MESSAGE_SENT, type MessageSentEvent } from "../../events/types";
import { emitNewMessage } from "../../lib/socket";
import { ROLES } from "../../utils/roles";
import type { Role } from "../../types/domain";

async function assertParticipant(userId: string, conversationId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant_ids: true }
  });
  if (!conv) throw NotFound("Conversation not found");
  if (!conv.participant_ids.includes(userId)) throw Forbidden("Not a participant");
  return conv;
}

// Shared contact gate for both createConversation and sendMessage. Blocks
// club/scout/organizer senders from reaching a pending-consent minor;
// admin always bypasses (Master Rule 1). Athlete-to-athlete is untouched.
async function assertCanContact(actor: { id: string; role: Role }, recipientId: string) {
  const recipient = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { id: true, status: true, is_minor: true, guardian_consent_status: true }
  });
  if (!recipient) throw NotFound("Recipient not found");
  if (recipient.status === "suspended") throw Forbidden("Recipient cannot receive messages");

  const isRestrictedAdultRole =
    (ROLES.RECRUITERS as readonly string[]).includes(actor.role) && actor.role !== "admin";
  if (isRestrictedAdultRole && recipient.is_minor && recipient.guardian_consent_status !== "approved") {
    throw Forbidden("This athlete is under 18. Messaging opens once their guardian approves contact.");
  }

  return recipient;
}

export async function createConversation(actor: { id: string; role: Role }, recipientId: string) {
  if (actor.id === recipientId) throw BadRequest("Cannot message yourself");

  const [sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.id }, select: { id: true } }),
    assertCanContact(actor, recipientId)
  ]);
  if (!sender) throw NotFound("User not found");

  const existing = await prisma.conversation.findFirst({
    where: { participant_ids: { hasEvery: [actor.id, recipientId] } },
    select: { id: true }
  });
  if (existing) return { id: existing.id, created: false };

  const conv = await prisma.conversation.create({
    data: { participant_ids: [actor.id, recipientId] },
    select: { id: true }
  });
  return { id: conv.id, created: true };
}

export async function sendMessage(actor: { id: string; role: Role }, recipientId: string, body: string) {
  if (actor.id === recipientId) throw BadRequest("Cannot message yourself");
  const senderId = actor.id;

  const [sender] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: { id: true, full_name: true } }),
    assertCanContact(actor, recipientId)
  ]);
  if (!sender) throw NotFound("Sender not found");

  let conversation = await prisma.conversation.findFirst({
    where: { participant_ids: { hasEvery: [senderId, recipientId] } },
    select: { id: true }
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { participant_ids: [senderId, recipientId] },
      select: { id: true }
    });
  }

  const convId = conversation.id;

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversation_id: convId, sender_id: senderId, recipient_id: recipientId, body }
    }),
    prisma.conversation.update({
      where: { id: convId },
      data: { last_message: { body, sender_id: senderId, at: new Date() } }
    }),
    // Atomic unread count increment for recipient using raw SQL (ON CONFLICT DO UPDATE)
    prisma.$executeRaw`
      INSERT INTO "UnreadCount" (id, conversation_id, user_id, count)
      VALUES (gen_random_uuid(), ${convId}::uuid, ${recipientId}::uuid, 1)
      ON CONFLICT (conversation_id, user_id)
      DO UPDATE SET count = "UnreadCount".count + 1
    `
  ]);

  eventBus.emit<MessageSentEvent>(MESSAGE_SENT, {
    messageId: message.id,
    senderId,
    senderName: sender.full_name,
    recipientId,
    conversationId: convId,
    bodyPreview: body.length > 120 ? body.slice(0, 117) + "..." : body,
  });

  emitNewMessage(convId, {
    id: message.id,
    conversation_id: convId,
    sender_id: senderId,
    recipient_id: recipientId,
    body,
    created_at: message.created_at.toISOString(),
  });

  return { conversation_id: convId, id: message.id };
}

export async function listConversations(userId: string, limit = 50) {
  const convs = await prisma.conversation.findMany({
    where: { participant_ids: { has: userId } },
    orderBy: { updated_at: "desc" },
    take: limit,
    include: {
      unread_counts_table: {
        where: { user_id: userId },
        select: { count: true }
      }
    }
  });

  const otherIds = [...new Set(
    convs.flatMap((c) => c.participant_ids.filter((p) => p !== userId))
  )];

  const users = otherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, full_name: true, role: true, profile_photo_url: true }
      })
    : [];

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return convs.map((c) => {
    const otherId = c.participant_ids.find((p) => p !== userId);
    const other   = otherId ? userMap[otherId] : null;
    const unreadRow = c.unread_counts_table[0];
    return {
      ...c,
      unread_counts_table: undefined,
      _unread_count: unreadRow?.count ?? 0,
      _other_name: other?.full_name ?? null,
      _other_sub:  other?.role ?? null,
      _other_avatar: other?.profile_photo_url ?? null,
      _other_id: otherId ?? null,
    };
  });
}

export async function listMessages(userId: string, conversationId: string, limit = 50, cursor?: string) {
  await assertParticipant(userId, conversationId);

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
  await assertParticipant(userId, conversationId);

  await prisma.$executeRaw`
    UPDATE "UnreadCount"
    SET count = 0
    WHERE conversation_id = ${conversationId}::uuid
      AND user_id = ${userId}::uuid
  `;
  return { ok: true };
}

