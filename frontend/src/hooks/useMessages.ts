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

const POLL_BACKOFF_INIT = 5_000;
const POLL_BACKOFF_MAX = 60_000;

export function useMessages(conversationId: string | null) {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);
  const backoffRef = useRef(POLL_BACKOFF_INIT);

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

      let shouldContinue = true;
      try {
        const result = await messageService.poll(convId, lastId, abortRef.current?.signal);
        backoffRef.current = POLL_BACKOFF_INIT; // reset on success
        if (result?.hasNew) {
          await qc.invalidateQueries({ queryKey: queryKeys.messages(convId) });
          await qc.invalidateQueries({ queryKey: queryKeys.conversations() });
        } else {
          // 204 No Content — short wait
          await new Promise((r) => setTimeout(r, 1_000));
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number }; code?: string };
        if (axiosErr?.code === "ERR_CANCELED") {
          shouldContinue = false; // aborted — stop polling
        } else if (axiosErr?.response?.status === 429) {
          await new Promise((r) => setTimeout(r, backoffRef.current));
          backoffRef.current = Math.min(backoffRef.current * 2, POLL_BACKOFF_MAX);
        } else {
          // network / timeout — short wait
          await new Promise((r) => setTimeout(r, 2_000));
        }
      } finally {
        pollingRef.current = false;
      }

      if (shouldContinue && abortRef.current && !abortRef.current.signal.aborted && convId) {
        const items = qc.getQueryData<Message[]>(queryKeys.messages(convId));
        const latestId = items?.[items.length - 1]?.id;
        startLongPoll(convId, latestId);
      }
    },
    [qc]
  );

  useEffect(() => {
    if (!conversationId) return;
    abortRef.current = new AbortController();
    backoffRef.current = POLL_BACKOFF_INIT;
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
