import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messageService, userService } from "../services";
import { queryKeys } from "./queryKeys";

export function useConversations() {
  const list = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messageService.getConversations(),
    refetchInterval: 60_000, // background safety net; WebSocket handles real-time
  });
  return { list };
}

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const messages = useQuery({
    queryKey: queryKeys.messages(conversationId ?? ""),
    queryFn: () => messageService.getMessages(conversationId!),
    enabled: !!conversationId,
    select: (data) => data.items,
  });

  useEffect(() => {
    if (!conversationId) return;
    messageService.markRead(conversationId)
      .then(() => qc.invalidateQueries({ queryKey: queryKeys.conversations() }))
      .catch(() => undefined);
  }, [conversationId, messages.data?.length, qc]);

  async function send(recipientId: string, body: string) {
    const result = await messageService.send({ recipient_id: recipientId, body });
    await qc.invalidateQueries({ queryKey: queryKeys.messages(result.conversation_id) });
    await qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    return result;
  }

  async function createConversation(recipientId: string) {
    const result = await messageService.createConversation({ recipient_id: recipientId });
    await qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    return result;
  }

  return { messages, send, createConversation };
}

export function useUserProfile(userId: string | null, enabled = true) {
  const profile = useQuery({
    queryKey: queryKeys.user(userId ?? ""),
    queryFn: () => userService.get(userId!),
    enabled: !!userId && enabled,
  });
  return { profile };
}
