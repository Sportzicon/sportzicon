import { useState } from "react";
import { useForm } from "react-hook-form";
import { useComments } from "../hooks";
import { useAuthStore } from "../store/auth";
import { Avatar } from "./UI";
import { Trash2, Pencil } from "lucide-react";
import type { CommentDoc, CommentParentType } from "../models";

interface CommentSectionProps {
  parentType: CommentParentType;
  parentId: string;
  commentCount: number;
  showForm?: boolean;
}

export function CommentSection({ parentType, parentId, commentCount: initialCount }: CommentSectionProps) {
  const { user } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const { register, handleSubmit, reset, watch } = useForm({ defaultValues: { text: "" } });

  const { list, add, update, remove } = useComments(parentType, parentId);

  const comments = [...new Map((list.data ?? []).map((c) => [c.id, c])).values()];
  const count = comments.length || initialCount;

  const onAdd = handleSubmit(async (data) => {
    if (data.text.trim()) {
      await add.mutateAsync(data.text);
      reset();
    }
  });

  return (
    <div className="mt-4">
      <div className="font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub mb-3">
        ❝ {count} {count === 1 ? "comment" : "comments"}
      </div>

      <div className="border-t border-hairsoft pt-4 space-y-4">
        {user && (
          <form onSubmit={onAdd} className="flex gap-2">
            <Avatar name={user.full_name} src={user.profile_photo_url} size={32} />
            <div className="flex-1 flex gap-2">
              <input {...register("text")} placeholder="Add a comment…" className="input flex-1 text-sm"
                disabled={add.isPending} />
              <button type="submit" disabled={add.isPending || !watch("text").trim()} className="btn-primary">
                Post
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="lab text-ink-faint">No comments yet.</p>
          ) : (
            comments.map((c: CommentDoc) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.author_name} size={32} />
                <div className="flex-1 rounded bg-fill p-3">
                  {editingId === c.id ? (
                    <div className="flex gap-2">
                      <input id={`edit-${c.id}`} type="text" defaultValue={c.text} className="input flex-1 text-sm" />
                      <button onClick={() => {
                        const el = document.getElementById(`edit-${c.id}`) as HTMLInputElement;
                        update.mutate({ id: c.id, text: el.value }, { onSuccess: () => setEditingId(null) });
                      }} disabled={update.isPending} className="btn-primary">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[12.5px] font-semibold text-ink">{c.author_name}</span>
                          <span className="lab ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        {user?.id === c.author_id && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => setEditingId(c.id)} className="text-ink-faint hover:text-ink p-0.5">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setPendingDeleteId(c.id)} className="text-ink-faint hover:text-red-600 p-0.5">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-[13.5px] text-ink-70 leading-snug">{c.text}</p>
                      {pendingDeleteId === c.id && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => remove.mutate(c.id, { onSuccess: () => setPendingDeleteId(null) })}
                            disabled={remove.isPending}
                            className="font-mononum text-[10px] uppercase tracking-[0.06em] text-red-600 hover:underline">
                            Confirm delete
                          </button>
                          <button onClick={() => setPendingDeleteId(null)}
                            className="font-mononum text-[10px] uppercase tracking-[0.06em] text-ink-sub hover:underline">
                            Cancel
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
