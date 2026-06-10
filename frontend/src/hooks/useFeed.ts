import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { postService } from "../services";
import { queryKeys } from "./queryKeys";
import type { CreatePostRequest } from "../models";

export function useFeed(limit = 30) {
  const qc = useQueryClient();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const feed = useQuery({
    queryKey: queryKeys.feed(limit),
    queryFn: () => postService.getFeed(limit),
  });

  const create = useMutation({
    mutationFn: (data: CreatePostRequest) => postService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });

  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => postService.update(id, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => postService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });

  const toggleLike = useMutation({
    mutationFn: (id: string) =>
      likedPosts.has(id) ? postService.unlike(id) : postService.like(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.feed(limit) });
      const prevFeed = qc.getQueryData(queryKeys.feed(limit));
      const isLiked = likedPosts.has(id);
      qc.setQueryData(queryKeys.feed(limit), (old: any[]) =>
        old?.map((p: any) => p.id === id
          ? { ...p, like_count: Math.max(0, p.like_count + (isLiked ? -1 : 1)) }
          : p
        )
      );
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
      return { prevFeed, wasLiked: isLiked };
    },
    onError: (_err: unknown, id: string, ctx: any) => {
      if (ctx?.prevFeed) qc.setQueryData(queryKeys.feed(limit), ctx.prevFeed);
      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feed() }),
  });

  return { feed, create, update, remove, toggleLike, likedPosts };
}
