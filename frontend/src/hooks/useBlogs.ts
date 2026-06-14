import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blogService } from "../services";
import { queryKeys } from "./queryKeys";
import type { Blog, BlogFilters } from "../models";

export function useBlogs(filters: BlogFilters = {}) {
  const infinite = useInfiniteQuery({
    queryKey: queryKeys.blogs(filters),
    queryFn: ({ pageParam }) =>
      blogService.list({ ...filters, cursor: pageParam as string | undefined, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  const allItems = infinite.data?.pages.flatMap((p) => p.items) ?? [];

  return { infinite, allItems };
}

export function useBlog(id: string, options?: { onDeleteSuccess?: () => void }) {
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: queryKeys.blog(id),
    queryFn: () => blogService.get(id),
    enabled: !!id,
  });

  const remove = useMutation({
    mutationFn: () => blogService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blogs() });
      qc.removeQueries({ queryKey: queryKeys.blog(id) });
      options?.onDeleteSuccess?.();
    },
  });

  const save = useMutation({
    mutationFn: (data: Partial<Blog>) =>
      id ? blogService.update(id, data) : blogService.create(data),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: queryKeys.blogs() });
      qc.invalidateQueries({ queryKey: queryKeys.blog(saved.id) });
    },
  });

  const like = useMutation({
    mutationFn: () => blogService.like(id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.blog(id) });
      const prev = qc.getQueryData<Blog>(queryKeys.blog(id));
      if (prev) {
        qc.setQueryData(queryKeys.blog(id), {
          ...prev,
          liked: true,
          like_count: prev.like_count + 1,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.blog(id), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blog(id) });
    },
  });

  const unlike = useMutation({
    mutationFn: () => blogService.unlike(id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queryKeys.blog(id) });
      const prev = qc.getQueryData<Blog>(queryKeys.blog(id));
      if (prev) {
        qc.setQueryData(queryKeys.blog(id), {
          ...prev,
          liked: false,
          like_count: Math.max(0, prev.like_count - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.blog(id), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blog(id) });
    },
  });

  return { detail, remove, save, like, unlike };
}
