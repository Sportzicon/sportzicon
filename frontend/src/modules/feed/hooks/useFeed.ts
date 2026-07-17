import { useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { postService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import type { ContentItem, CreatePostRequest, UpdatePostRequest } from "../../../models";
import type { FeedPage } from "../services/post.service";

export function useFeed() {
  const qc = useQueryClient();

  const feedQuery = useInfiniteQuery({
    queryKey: queryKeys.feedInfinite(),
    queryFn: ({ pageParam }) => postService.getFeedPage(pageParam as string | undefined),
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const items: ContentItem[] = feedQuery.data?.pages.flatMap((p) => p.data) ?? [];
  // Server tells us who this viewer liked; derive the Set straight from it
  // so refreshing the page doesn't lose the heart state.
  const likedPosts = useMemo(
    () => new Set(items.filter((i) => i.liked).map((i) => i.id)),
    [items]
  );

  const create = useMutation({
    mutationFn: (data: CreatePostRequest) => postService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePostRequest) => postService.update(id, data),
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
                ? {
                    ...p,
                    like_count: Math.max(0, p.like_count + (isLiked ? -1 : 1)),
                    liked: !isLiked,
                  }
                : p
            ),
          })),
        };
      });

      return { prevData, wasLiked: isLiked };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevData) qc.setQueryData(queryKeys.feedInfinite(), ctx.prevData);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });

  return { feedQuery, items, create, update, remove, toggleLike, likedPosts };
}
