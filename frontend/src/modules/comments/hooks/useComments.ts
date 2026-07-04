import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentService } from "../../../services";
import { queryKeys } from "../../../hooks/queryKeys";
import type { CommentDoc, CommentParentType } from "../../../models";
import type { CommentPage } from "../services/comment.service";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      if (parentType === "reel") qc.invalidateQueries({ queryKey: queryKeys.reels() });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      commentService.update(id, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => commentService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      if (parentType === "reel") qc.invalidateQueries({ queryKey: queryKeys.reels() });
    },
  });

  const toggleLike = useMutation({
    mutationFn: (c: CommentDoc) => (c.liked ? commentService.unlike(c.id) : commentService.like(c.id)),
    onMutate: async (c: CommentDoc) => {
      await qc.cancelQueries({ queryKey: key });
      const prevData = qc.getQueryData<CommentPage>(key);

      qc.setQueryData<CommentPage>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((item) =>
            item.id === c.id
              ? { ...item, liked: !item.liked, like_count: Math.max(0, item.like_count + (item.liked ? -1 : 1)) }
              : item
          ),
        };
      });

      return { prevData };
    },
    onError: (_err, _c, ctx) => {
      if (ctx?.prevData) qc.setQueryData(key, ctx.prevData);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { list, add, update, remove, toggleLike };
}
