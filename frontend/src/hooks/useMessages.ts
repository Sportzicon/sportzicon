import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messageService, userService } from "../services";
import { queryKeys } from "./queryKeys";
import type { Message } from "../models";

export function useConversations() {
  const list = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messageService.getConversations(),
    refetchInterval: 30_000, // fallback poll — long-poll keeps thread fresh
  });
  return { list };
}

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);

  const messages = useQuery({
    queryKey: queryKeys.messages(conversationId ?? ""),
    queryFn: () => messageService.getMessages(conversationId!),
    enabled: !!conversationId,
    select: (data) => data.items,
  });

  const startLongPoll = useCallback(
    async (convId: string, lastId?: string) => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      abortRef.current = new AbortController();

      try {
        const result = await messageService.poll(convId, lastId, abortRef.current.signal);
        if (result?.hasNew) {
          await qc.invalidateQueries({ queryKey: queryKeys.messages(convId) });
          await qc.invalidateQueries({ queryKey: queryKeys.conversations() });
        } else if (result === null) {
          // Network error or abort — wait 1s before retry
          await new Promise((r) => setTimeout(r, 1_000));
        } else {
          // 204 No Content: wait 1s then poll again
          await new Promise((r) => setTimeout(r, 1_000));
        }
      } finally {
        pollingRef.current = false;
      }

      // Continue polling if still mounted
      if (abortRef.current && !abortRef.current.signal.aborted && convId) {
        const items = qc.getQueryData<Message[]>(queryKeys.messages(convId));
        const latestId = items?.[items.length - 1]?.id;
        startLongPoll(convId, latestId);
      }
    },
    [qc]
  );

  useEffect(() => {
    if (!conversationId) return;
    const items = qc.getQueryData<Message[]>(queryKeys.messages(conversationId));
    const latestId = items?.[items.length - 1]?.id;
    startLongPoll(conversationId, latestId);

    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      pollingRef.current = false;
    };
  }, [conversationId, startLongPoll, qc]);

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
