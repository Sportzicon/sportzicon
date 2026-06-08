import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reelService } from "../services";
import { queryKeys } from "./queryKeys";

export function useReels() {
  const qc = useQueryClient();
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());

  const list = useQuery({
    queryKey: queryKeys.reels(),
    queryFn: () => reelService.list(50),
  });

  const toggleLike = useMutation({
    mutationFn: (id: string) =>
      likedReels.has(id) ? reelService.unlike(id) : reelService.like(id),
    onMutate: (id: string) => {
      setLikedReels((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onError: (_err: unknown, id: string) => {
      setLikedReels((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => reelService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  const update = useMutation({
    mutationFn: ({ id, caption, sport }: { id: string; caption?: string; sport?: string }) =>
      reelService.update(id, { caption, sport }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.reels() }),
  });

  return { list, toggleLike, likedReels, remove, update };
}
