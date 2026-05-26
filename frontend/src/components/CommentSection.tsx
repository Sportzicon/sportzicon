import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { MessageCircle, Trash2, Pencil, X } from "lucide-react";
import type { CommentDoc } from "../types";

interface CommentSectionProps {
  parentType: "post" | "reel" | "blog";
  parentId: string;
  commentCount: number;
  showForm?: boolean;
}

export function CommentSection({ parentType, parentId, commentCount: initialCount, showForm = false }: CommentSectionProps) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(showForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch } = useForm({ defaultValues: { text: "" } });
  const { data: commentsData } = useQuery({
    queryKey: ["comments", parentType, parentId],
    queryFn: async () => (await api.get(`/${parentType}s/${parentId}/comments`)).data.items as CommentDoc[],
    enabled: open || showForm
  });

  const comments = commentsData ?? [];
  const commentCount = open ? comments.length : initialCount;

  const addMutation = useMutation({
    mutationFn: async (text: string) =>
      (await api.post(`/${parentType}s/${parentId}/comments`, { text })).data.comment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", parentType, parentId] });
      reset();
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      (await api.put(`/comments/${id}`, { text })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", parentType, parentId] });
      setEditingId(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/comments/${id}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", parentType, parentId] });
      setPendingDeleteId(null);
    }
  });

  const onAddComment = handleSubmit(async (data) => {
    if (data.text.trim()) await addMutation.mutateAsync(data.text);
  });

  return (
    <>
      {!showForm && (
        <button
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1 hover:text-brand-700"
        >
          <MessageCircle className="h-4 w-4" /> {commentCount}
        </button>
      )}

      {(open || showForm) && (
        <div className="mt-4 border-t pt-4 space-y-4">
          <form onSubmit={onAddComment} className="flex gap-2">
            <input
              {...register("text")}
              placeholder="Add a comment..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none"
              disabled={addMutation.isPending}
            />
            <button
              type="submit"
              disabled={addMutation.isPending || !watch("text").trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Post
            </button>
          </form>

          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500">No comments yet</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-50 p-3">
                  {editingId === c.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        defaultValue={c.text}
                        id={`edit-${c.id}`}
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-brand-600 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          const input = document.getElementById(`edit-${c.id}`) as HTMLInputElement;
                          updateMutation.mutate({ id: c.id, text: input.value });
                        }}
                        disabled={updateMutation.isPending}
                        className="text-brand-600 hover:text-brand-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-slate-600 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{c.author_name}</p>
                          <p className="mt-1 text-sm text-slate-700">{c.text}</p>
                        </div>
                        {user?.id === c.author_id && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingId(c.id)}
                              className="text-slate-500 hover:text-slate-700"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setPendingDeleteId(c.id)}
                              className="text-slate-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      {pendingDeleteId === c.id && (
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => deleteMutation.mutate(c.id)}
                            disabled={deleteMutation.isPending}
                            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Confirm delete
                          </button>
                          <button onClick={() => setPendingDeleteId(null)} className="text-xs text-slate-600">
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
