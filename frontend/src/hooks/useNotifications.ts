import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificationService } from "../services";
import { queryKeys } from "./queryKeys";
import { useNotificationStore } from "../store/notifications";
import type { NotificationPage } from "../models";

export function useNotificationCount(enabled = true) {
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const query = useQuery({
    queryKey: queryKeys.notifCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30_000,
    enabled,
  });

  useEffect(() => {
    if (query.data !== undefined) setUnreadCount(query.data);
  }, [query.data, setUnreadCount]);

  return { count: query };
}

export function useNotifications() {
  const qc = useQueryClient();

  const list = useInfiniteQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) =>
      notificationService.list(pageParam as string | undefined),
    getNextPageParam: (last: NotificationPage) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: queryKeys.notifCount() });
    },
  });

  const markOneRead = useMutation({
    mutationFn: (id: string) => notificationService.markOneRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: queryKeys.notifCount() });
    },
  });

  return { list, markAllRead, markOneRead };
}
