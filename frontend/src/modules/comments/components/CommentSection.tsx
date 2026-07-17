import { useState } from "react";
import { useForm } from "react-hook-form";
import { useComments } from "../../../hooks";
import { useAuthStore } from "../../../store/auth";
import { Avatar } from "../../../components/UI";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { Trash2, Pencil, MessageCircle, Heart } from "lucide-react";
import { isAdmin } from "../../../utils/roles";
import { formatDate } from "../../../utils/date";
import type { CommentDoc, CommentParentType } from "../../../models";

interface CommentSectionProps {
  parentType: CommentParentType;
  parentId: string;
  commentCount: number;
  /** When true, skip the nested MobileDrawer and render full inline list+form.
   *  Use this when CommentSection is already inside a MobileDrawer. */
  inDrawer?: boolean;
  /** When true, show only a "N comments" trigger until clicked — no comment
   *  fetch/render (and no add-comment form) until revealed. */
  startCollapsed?: boolean;
}

function CommentItem({
  c,
  currentUserId,
  currentUserRole,
  onEdit,
  onDelete,
  onToggleLike,
}: {
  c: CommentDoc;
  currentUserId?: string;
  currentUserRole?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLike: (c: CommentDoc) => void;
}) {
  const canManage = c.author_id === currentUserId || isAdmin(currentUserRole ?? "");

  return (
    <div className="flex gap-3">
      <Avatar name={c.author_name} src={(c as any).author?.profile_photo_url} size={32} />
      <div className="flex-1 rounded bg-fill p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[12.5px] font-semibold text-ink">{c.author_name}</span>
            <span className="lab ml-2">{formatDate(c.created_at)}</span>
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
        <button
          onClick={() => currentUserId && onToggleLike(c)}
          disabled={!currentUserId}
          className={`mt-1.5 flex items-center gap-1 text-xs min-h-[44px] ${c.liked ? "text-red-600" : "text-ink-faint hover:text-ink"}`}
          aria-label={c.liked ? "Unlike comment" : "Like comment"}
        >
          <Heart className="h-3.5 w-3.5" fill={c.liked ? "currentColor" : "none"} />
          {c.like_count > 0 && c.like_count}
        </button>
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

// Extracted as top-level component so React doesn't recreate the type every render.
function InlineEditOrDelete({
  c,
  editingId,
  pendingDeleteId,
  onSaveEdit,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  isUpdatePending,
  isRemovePending,
}: {
  c: CommentDoc;
  editingId: string | null;
  pendingDeleteId: string | null;
  onSaveEdit: (id: string, text: string) => void;
  onCancelEdit: () => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  isUpdatePending: boolean;
  isRemovePending: boolean;
}) {
  const [editText, setEditText] = useState(c.text);

  if (editingId === c.id) {
    return (
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="input flex-1 text-sm min-h-[44px]"
          autoFocus
        />
        <button
          onClick={() => onSaveEdit(c.id, editText)}
          disabled={isUpdatePending || !editText.trim()}
          className="btn-primary min-h-[44px]"
        >
          Save
        </button>
        <button onClick={onCancelEdit} className="btn-secondary min-h-[44px]">
          ✕
        </button>
      </div>
    );
  }

  if (pendingDeleteId === c.id) {
    return (
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => onConfirmDelete(c.id)}
          disabled={isRemovePending}
          className="font-mononum text-[10px] uppercase tracking-[0.06em] text-red-600 hover:underline min-h-[44px]"
        >
          Confirm delete
        </button>
        <button
          onClick={onCancelDelete}
          className="font-mononum text-[10px] uppercase tracking-[0.06em] text-ink-sub hover:underline min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    );
  }

  return null;
}

export function CommentSection({
  parentType,
  parentId,
  commentCount: initialCount,
  inDrawer = false,
  startCollapsed = false,
}: CommentSectionProps) {
  const { user } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revealed, setRevealed] = useState(!startCollapsed);
  const { list, add, update, remove, toggleLike } = useComments(parentType, parentId, { enabled: revealed });

  const comments = list.data ?? [];
  const count = comments.length || initialCount;
  const previewComments = comments.slice(0, 3);
  const hasMore = comments.length > 3;

  const handleEdit = (id: string) => {
    setPendingDeleteId(null);
    setEditingId(id);
  };
  const handleDelete = (id: string) => {
    setEditingId(null);
    setPendingDeleteId(id);
  };
  const handleSaveEdit = (id: string, text: string) => {
    update.mutate({ id, text }, { onSuccess: () => setEditingId(null) });
  };
  const handleConfirmDelete = (id: string) => {
    remove.mutate(id, { onSuccess: () => setPendingDeleteId(null) });
  };

  const handleAddComment = async (text: string) => {
    await add.mutateAsync(text);
  };

  const handleToggleLike = (c: CommentDoc) => {
    toggleLike.mutate(c);
  };

  const editDeleteProps = {
    editingId,
    pendingDeleteId,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: () => setEditingId(null),
    onConfirmDelete: handleConfirmDelete,
    onCancelDelete: () => setPendingDeleteId(null),
    isUpdatePending: update.isPending,
    isRemovePending: remove.isPending,
  };

  const addForm = (
    <AddCommentForm
      onSubmit={handleAddComment}
      isPending={add.isPending}
      userId={user?.id}
      userPhotoUrl={user?.profile_photo_url}
      userName={user?.full_name}
    />
  );

  const commentList = (
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
              onToggleLike={handleToggleLike}
            />
            <InlineEditOrDelete c={c} key={`eod-${c.id}`} {...editDeleteProps} />
          </div>
        ))
      )}
    </div>
  );

  // Collapsed: show only a trigger, no fetch/render until clicked.
  if (startCollapsed && !revealed) {
    return (
      <button
        onClick={() => setRevealed(true)}
        className="mt-4 flex items-center gap-1.5 font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub min-h-[44px]"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {initialCount} {initialCount === 1 ? "comment" : "comments"}
      </button>
    );
  }

  // When already inside a MobileDrawer (e.g. Reels page), render full inline
  // view to avoid nested drawers conflicting with each other.
  if (inDrawer) {
    return (
      <div className="flex flex-col gap-4">
        {addForm}
        <div className="border-t border-hairsoft pt-3">{commentList}</div>
      </div>
    );
  }

  const drawerFooter = (
    <div className="p-3">
      {addForm}
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
              onToggleLike={handleToggleLike}
                />
                <InlineEditOrDelete c={c} key={`eod-${c.id}`} {...editDeleteProps} />
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
            {addForm}
          </div>
        )}

        <MobileDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={`${count} ${count === 1 ? "Comment" : "Comments"}`}
          footer={drawerFooter}
        >
          {commentList}
        </MobileDrawer>
      </div>

      {/* Desktop: full inline */}
      <div className="hidden lg:block">
        <div className="font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub mb-3">
          ❝ {count} {count === 1 ? "comment" : "comments"}
        </div>
        <div className="border-t border-hairsoft pt-4 space-y-4">
          {addForm}
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
              onToggleLike={handleToggleLike}
                  />
                  <InlineEditOrDelete c={c} key={`eod-${c.id}`} {...editDeleteProps} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
