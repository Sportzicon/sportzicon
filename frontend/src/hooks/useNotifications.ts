import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services";
import { queryKeys } from "./queryKeys";

export function useNotificationCount(enabled = true) {
  const count = useQuery({
    queryKey: queryKeys.notifCount(),
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: 30_000,
    enabled,
  });

  return { count };
}

export function useNotifications() {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => notificationService.list(),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications() });
      qc.invalidateQueries({ queryKey: queryKeys.notifCount() });
    },
  });

  return { list, markAllRead };
}
