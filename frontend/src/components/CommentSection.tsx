import { useState } from "react";
import { useForm } from "react-hook-form";
import { useComments } from "../hooks";
import { useAuthStore } from "../store/auth";
import { Avatar } from "./UI";
import { MobileDrawer } from "./MobileDrawer";
import { Trash2, Pencil, MessageCircle } from "lucide-react";
import { isAdmin } from "../utils/roles";
import type { CommentDoc, CommentParentType } from "../models";

interface CommentSectionProps {
  parentType: CommentParentType;
  parentId: string;
  commentCount: number;
}

function CommentItem({
  c,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
}: {
  c: CommentDoc;
  currentUserId?: string;
  currentUserRole?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const canManage = c.author_id === currentUserId || isAdmin(currentUserRole ?? "");

  return (
    <div className="flex gap-3">
      <Avatar name={c.author_name} src={(c as any).author?.profile_photo_url} size={32} />
      <div className="flex-1 rounded bg-fill p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[12.5px] font-semibold text-ink">{c.author_name}</span>
            <span className="lab ml-2">{new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          {canManage && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onEdit(c.id)}
                className="text-ink-faint hover:text-ink p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Edit comment"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="text-ink-faint hover:text-red-600 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Delete comment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <p className="mt-1 text-[13.5px] text-ink-70 leading-snug">{c.text}</p>
      </div>
    </div>
  );
}

function AddCommentForm({
  onSubmit,
  isPending,
  userId,
  userPhotoUrl,
  userName,
}: {
  onSubmit: (text: string) => Promise<void>;
  isPending: boolean;
  userId?: string;
  userPhotoUrl?: string;
  userName?: string;
}) {
  const { register, handleSubmit, reset, watch } = useForm({ defaultValues: { text: "" } });
  if (!userId) return null;
  return (
    <form
      onSubmit={handleSubmit(async (d) => {
        if (d.text.trim()) {
          await onSubmit(d.text.trim());
          reset();
        }
      })}
      className="flex gap-2"
    >
      <Avatar name={userName ?? ""} src={userPhotoUrl} size={32} />
      <div className="flex-1 flex gap-2">
        <input
          {...register("text")}
          placeholder="Add a comment…"
          className="input flex-1 text-sm min-h-[44px]"
          disabled={isPending}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={isPending || !watch("text").trim()}
          className="btn-primary min-h-[44px] px-4"
        >
          Post
        </button>
      </div>
    </form>
  );
}

export function CommentSection({ parentType, parentId, commentCount: initialCount }: CommentSectionProps) {
  const { user } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { list, add, update, remove } = useComments(parentType, parentId);

  const comments = list.data ?? [];
  const count = comments.length || initialCount;
  const previewComments = comments.slice(0, 3);
  const hasMore = comments.length > 3;

  const handleEdit = (id: string) => setEditingId(id);
  const handleDelete = (id: string) => setPendingDeleteId(id);

  const handleAddComment = async (text: string) => {
    await add.mutateAsync(text);
  };

  function InlineEditOrDelete({ c }: { c: CommentDoc }) {
    return (
      <>
        {editingId === c.id && (
          <div className="mt-2 flex gap-2">
            <input
              id={`edit-${c.id}`}
              type="text"
              defaultValue={c.text}
              className="input flex-1 text-sm min-h-[44px]"
            />
            <button
              onClick={() => {
                const el = document.getElementById(`edit-${c.id}`) as HTMLInputElement;
                update.mutate({ id: c.id, text: el.value }, { onSuccess: () => setEditingId(null) });
              }}
              disabled={update.isPending}
              className="btn-primary min-h-[44px]"
            >
              Save
            </button>
            <button onClick={() => setEditingId(null)} className="btn-secondary min-h-[44px]">
              ✕
            </button>
          </div>
        )}
        {pendingDeleteId === c.id && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() =>
                remove.mutate(c.id, { onSuccess: () => setPendingDeleteId(null) })
              }
              disabled={remove.isPending}
              className="font-mononum text-[10px] uppercase tracking-[0.06em] text-red-600 hover:underline min-h-[44px]"
            >
              Confirm delete
            </button>
            <button
              onClick={() => setPendingDeleteId(null)}
              className="font-mononum text-[10px] uppercase tracking-[0.06em] text-ink-sub hover:underline min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        )}
      </>
    );
  }

  const drawerFooter = (
    <div className="p-3">
      <AddCommentForm
        onSubmit={handleAddComment}
        isPending={add.isPending}
        userId={user?.id}
        userPhotoUrl={user?.profile_photo_url}
        userName={user?.full_name}
      />
    </div>
  );

  return (
    <div className="mt-4">
      {/* Mobile: show preview + drawer trigger */}
      <div className="lg:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-1.5 font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub mb-3 min-h-[44px]"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {count} {count === 1 ? "comment" : "comments"}
        </button>

        {previewComments.length > 0 && (
          <div className="space-y-3 border-t border-hairsoft pt-3">
            {previewComments.map((c) => (
              <div key={c.id}>
                <CommentItem
                  c={c}
                  currentUserId={user?.id}
                  currentUserRole={user?.role}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                <InlineEditOrDelete c={c} />
              </div>
            ))}
            {(hasMore || count > 3) && (
              <button
                onClick={() => setDrawerOpen(true)}
                className="text-brand-500 text-sm min-h-[44px] w-full text-left"
              >
                View all {count} comments →
              </button>
            )}
          </div>
        )}

        {previewComments.length === 0 && (
          <div className="border-t border-hairsoft pt-3">
            <AddCommentForm
              onSubmit={handleAddComment}
              isPending={add.isPending}
              userId={user?.id}
              userPhotoUrl={user?.profile_photo_url}
              userName={user?.full_name}
            />
          </div>
        )}

        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${count} ${count === 1 ? "Comment" : "Comments"}`}
          footer={drawerFooter}
        >
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="lab text-ink-faint">No comments yet. Be the first!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id}>
                  <CommentItem
                    c={c}
                    currentUserId={user?.id}
                    currentUserRole={user?.role}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                  <InlineEditOrDelete c={c} />
                </div>
              ))
            )}
          </div>
        </MobileDrawer>
      </div>

      {/* Desktop: full inline */}
      <div className="hidden lg:block">
        <div className="font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub mb-3">
          ❝ {count} {count === 1 ? "comment" : "comments"}
        </div>
        <div className="border-t border-hairsoft pt-4 space-y-4">
          <AddCommentForm
            onSubmit={handleAddComment}
            isPending={add.isPending}
            userId={user?.id}
            userPhotoUrl={user?.profile_photo_url}
            userName={user?.full_name}
          />
          <div className="space-y-3">
            {comments.length === 0 ? (
              <p className="lab text-ink-faint">No comments yet.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id}>
                  <CommentItem
                    c={c}
                    currentUserId={user?.id}
                    currentUserRole={user?.role}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                  <InlineEditOrDelete c={c} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
