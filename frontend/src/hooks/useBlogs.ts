import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { blogService } from "../services";
import { queryKeys } from "./queryKeys";
import type { Blog, BlogFilters } from "../models";

export function useBlogs(filters: BlogFilters = {}) {
  const list = useQuery({
    queryKey: queryKeys.blogs(filters),
    queryFn: () => blogService.list(filters),
  });

  return { list };
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

  return { detail, remove, save };
}
