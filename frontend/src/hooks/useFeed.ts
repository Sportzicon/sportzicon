import { useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { postService } from "../services";
import { queryKeys } from "./queryKeys";
import type { CreatePostRequest, Post } from "../models";
import type { FeedPage } from "../services/post.service";

export function useFeed() {
  const qc = useQueryClient();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const feedQuery = useInfiniteQuery({
    queryKey: queryKeys.feedInfinite(),
    queryFn: ({ pageParam }) => postService.getFeedPage(pageParam as string | undefined),
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const posts: Post[] = feedQuery.data?.pages.flatMap((p) => p.data) ?? [];

  const create = useMutation({
    mutationFn: (data: CreatePostRequest) => postService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => postService.update(id, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => postService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  const toggleLike = useMutation({
    mutationFn: (id: string) =>
      likedPosts.has(id) ? postService.unlike(id) : postService.like(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: queryKeys.feedInfinite() });
      const prevData = qc.getQueryData<InfiniteData<FeedPage>>(queryKeys.feedInfinite());
      const isLiked = likedPosts.has(id);

      qc.setQueryData<InfiniteData<FeedPage>>(queryKeys.feedInfinite(), (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: page.data.map((p) =>
              p.id === id
                ? { ...p, like_count: Math.max(0, p.like_count + (isLiked ? -1 : 1)) }
                : p
            ),
          })),
        };
      });

      setLikedPosts((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });

      return { prevData, wasLiked: isLiked };
    },
    onError: (_err, id, ctx) => {
      if (ctx?.prevData) qc.setQueryData(queryKeys.feedInfinite(), ctx.prevData);
      setLikedPosts((prev) => {
        const next = new Set(prev);
        ctx?.wasLiked ? next.add(id) : next.delete(id);
        return next;
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  return { feedQuery, posts, create, update, remove, toggleLike, likedPosts };
}
