import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentService } from "../services";
import { queryKeys } from "./queryKeys";
import type { CommentParentType } from "../models";

export function useComments(parentType: CommentParentType, parentId: string) {
  const qc = useQueryClient();
  const key = queryKeys.comments(parentType, parentId);

  const list = useQuery({
    queryKey: key,
    queryFn: () => commentService.list(parentType, parentId),
    select: (page) => page.data,
  });

  const add = useMutation({
    mutationFn: (text: string) => commentService.add(parentType, parentId, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      commentService.update(id, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => commentService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, add, update, remove };
}
