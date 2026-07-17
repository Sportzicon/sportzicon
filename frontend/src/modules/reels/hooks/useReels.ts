import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reelService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import type { Reel } from "../../../models";
import type { InfiniteData } from "@tanstack/react-query";
import type { ReelPage } from "../services/reel.service";

export function useReels(filters?: { author_id?: string; sport?: string }) {
  const qc = useQueryClient();

  const list = useInfiniteQuery<ReelPage, Error, InfiniteData<ReelPage>, ReturnType<typeof queryKeys.reels>, string | null>({
    queryKey: queryKeys.reels(),
    queryFn: ({ pageParam }) =>
      reelService.list({ limit: 10, cursor: pageParam ?? undefined, ...filters }),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? null,
  });

  const allReels: Reel[] = list.data?.pages.flatMap((p) => p.items) ?? [];
  // Server tells us who this viewer liked; derive the Set straight from it
  // so refreshing the page doesn't lose the heart state.
  const likedReels = useMemo(
    () => new Set(allReels.filter((r) => r.liked).map((r) => r.id)),
    [allReels]
  );

  const toggleLike = useMutation({
    mutationFn: async (id: string) => {
      if (likedReels.has(id)) return reelService.unlike(id);
      return reelService.like(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => reelService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  const update = useMutation({
    mutationFn: ({ id, title, description, sport }: { id: string; title?: string; description?: string; sport?: string }) =>
      reelService.update(id, { title, description, sport }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  return { list, allReels, toggleLike, likedReels, remove, update };
}
