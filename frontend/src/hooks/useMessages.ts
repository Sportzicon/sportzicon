import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messageService, userService } from "../services";
import { queryKeys } from "./queryKeys";

export function useConversations() {
  const list = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messageService.getConversations(),
    refetchInterval: 15_000,
  });

  return { list };
}

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();

  const messages = useQuery({
    queryKey: queryKeys.messages(conversationId ?? ""),
    queryFn: () => messageService.getMessages(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!conversationId) return;
    messageService.markRead(conversationId).catch(() => undefined);
  }, [conversationId, messages.data?.length]);

  async function send(recipientId: string, body: string) {
    await messageService.send({ recipient_id: recipientId, body });
    qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId ?? "") });
    qc.invalidateQueries({ queryKey: queryKeys.conversations() });
  }

  return { messages, send };
}

export function useUserProfile(userId: string | null, enabled = true) {
  const profile = useQuery({
    queryKey: queryKeys.user(userId ?? ""),
    queryFn: () => userService.get(userId!),
    enabled: !!userId && enabled,
  });

  return { profile };
}
