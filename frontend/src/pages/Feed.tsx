import { useState, useRef, useEffect } from "react";
import { useFeed } from "../hooks";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, EmptyState, Avatar, Tabs } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, PenLine, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { humanizeError } from "../api/client";
import type { Post } from "../models";

const MAX_CHARS = 2000;

// Post card with read-more toggle, media, likes, comments
function PostCard({
  p,
  currentUserId,
  isLiked,
  onToggleLike,
  onEdit,
  onDelete,
}: {
  p: Post;
  currentUserId?: string;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = currentUserId === p.author_id;
  const longText = p.text.length > 300;

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu]")) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  return (
    <li className="panel p-4 sm:p-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Link to={`/profile/${p.author_id}`}>
          <Avatar name={p.author_name ?? ""} src={p.author?.profile_photo_url} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/profile/${p.author_id}`}
              className="text-[13.5px] font-semibold text-ink hover:text-brand-500 truncate"
            >
              {p.author_name}
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="lab">{new Date(p.created_at).toLocaleDateString()}</span>
              {isOwner && (
                <div className="relative" data-menu>
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-ink-faint hover:text-ink hover:bg-fill"
                    aria-label="Post options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                      <button
                        onClick={() => { onEdit(p.id); setMenuOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill flex items-center gap-2 border-b border-hairsoft min-h-[44px]"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => { onDelete(p.id); setMenuOpen(false); }}
                        className="w-full text-left px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 flex items-center gap-2 min-h-[44px]"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="lab mt-0.5">
            {p.type === "log" ? "Training log" : "Update"}
            {p.sport ? ` · ${p.sport}` : ""}
          </div>
        </div>
      </div>

      {/* Post text with read-more */}
      <div className="mt-3">
        <p
          className={`text-[14.5px] text-ink-70 leading-relaxed whitespace-pre-wrap ${
            !expanded && longText ? "line-clamp-3" : ""
          }`}
        >
          {p.text}
        </p>
        {longText && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-brand-500 text-sm mt-1 min-h-[44px] flex items-center"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Media */}
      {p.media_urls && p.media_urls.length > 0 && (
        <div className="mt-3 space-y-2">
          {p.media_urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full max-h-80 object-cover rounded-lg"
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* Like / Comment row */}
      <div className="mt-4 pt-3 border-t border-hairsoft flex items-center gap-5">
        <button
          onClick={() => onToggleLike(p.id)}
          className={`font-mononum text-[11.5px] flex items-center gap-1.5 transition min-h-[44px] ${
            isLiked ? "text-brand-500" : "text-ink-sub hover:text-brand-500"
          }`}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <Heart className="h-4 w-4" fill={isLiked ? "currentColor" : "none"} />
          {p.like_count}
        </button>
        <span className="font-mononum text-[11.5px] text-ink-sub flex items-center gap-1.5 min-h-[44px]">
          <MessageCircle className="h-4 w-4" /> {p.comment_count}
        </span>
      </div>

      <CommentSection parentType="post" parentId={p.id} commentCount={p.comment_count} />
    </li>
  );
}

// Pull-to-refresh indicator
function PullIndicator({ distance, isRefreshing }: { distance: number; isRefreshing: boolean }) {
  if (distance === 0 && !isRefreshing) return null;
  return (
    <div
      className="flex items-center justify-center gap-2 text-ink-sub text-sm transition-all"
      style={{ height: isRefreshing ? 44 : distance * 0.55 }}
    >
      <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-brand-500" : ""}`} />
      {isRefreshing ? "Refreshing…" : distance >= 60 ? "Release to refresh" : "Pull to refresh"}
    </div>
  );
}

export default function Feed() {
  const user = useAuthStore((s) => s.user);
  const { feedQuery, posts, create, update, remove, toggleLike, likedPosts } = useFeed();
  const [text, setText] = useState("");
  const [type, setType] = useState<"post" | "log">("post");
  const [tab, setTab] = useState("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const filtered = tab === "Updates"
    ? posts.filter((p) => p.type === "post")
    : tab === "Training logs"
    ? posts.filter((p) => p.type === "log")
    : posts;

  const charsLeft = MAX_CHARS - text.length;

  // Pull-to-refresh touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    const dist = e.touches[0].clientY - touchStartY.current;
    if (dist > 0) setPullDistance(Math.min(dist, 80));
  };
  const onTouchEnd = async () => {
    if (pullDistance >= 60) {
      setIsRefreshing(true);
      await feedQuery.refetch();
      setIsRefreshing(false);
    }
    setPullDistance(0);
  };

  const handleCreate = () => {
    if (!text.trim()) return;
    setCreateError("");
    create.mutate(
      { type, text: text.trim() },
      {
        onSuccess: () => {
          setText("");
          setCreateOpen(false);
        },
        onError: (err) => setCreateError(humanizeError(err)),
      }
    );
  };

  const createForm = (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["post", "log"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 min-h-[44px] rounded border transition ${
              type === t
                ? "bg-ink text-paper border-ink"
                : "border-hair text-ink-sub hover:border-ink hover:text-ink"
            }`}
          >
            {t === "log" ? "Training log" : "Update"}
          </button>
        ))}
      </div>
      <div>
        <textarea
          className="input w-full"
          rows={4}
          placeholder={type === "log" ? "What did you train today?" : "Share an update with your network…"}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          style={{ resize: "none" }}
        />
        <div className={`text-right text-xs mt-1 ${charsLeft < 200 ? "text-red-500" : "text-ink-faint"}`}>
          {text.length}/{MAX_CHARS}
        </div>
      </div>
      {createError && <p className="text-sm text-red-600">{createError}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setCreateOpen(false); setText(""); setCreateError(""); }}
          className="btn-secondary min-h-[44px]"
        >
          Cancel
        </button>
        <button
          className="btn-accent min-h-[44px]"
          disabled={create.isPending || !text.trim()}
          onClick={handleCreate}
        >
          {create.isPending ? "Posting…" : "Post →"}
        </button>
      </div>
    </div>
  );

  return (
    <div
      ref={feedRef}
      className="max-w-2xl space-y-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PageHeader title="Feed" subtitle="Your network" />

      <PullIndicator distance={pullDistance} isRefreshing={isRefreshing} />

      {/* Create post — collapsed tap-target on mobile, always open on desktop */}
      <ErrorBoundary>
      <div className="panel p-4">
        {/* Mobile collapsed state */}
        <div className="lg:hidden">
          {!createOpen ? (
            <button
              onClick={() => setCreateOpen(true)}
              className="w-full flex items-center gap-3 min-h-[44px]"
              aria-label="Create post"
            >
              <Avatar name={user?.full_name ?? ""} src={user?.profile_photo_url} size={36} accent />
              <span className="flex-1 text-left text-sm text-ink-faint bg-fill rounded-full px-4 py-2">
                Share an update…
              </span>
              <PenLine className="h-5 w-5 text-ink-faint" />
            </button>
          ) : (
            createForm
          )}
        </div>

        {/* Desktop: always visible */}
        <div className="hidden lg:block">
          <div className="flex gap-3 mb-3">
            <Avatar name={user?.full_name ?? ""} src={user?.profile_photo_url} size={40} accent />
            <div className="flex-1">
              {createForm}
            </div>
          </div>
        </div>
      </div>

      </ErrorBoundary>

      <Tabs tabs={["All", "Updates", "Training logs"]} active={tab} onChange={setTab} />

      <ErrorBoundary>
      {feedQuery.isLoading ? (
        <div className="panel p-8 flex justify-center">
          <Spinner className="text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" hint="Follow people or post your first training log." />
      ) : (
        <>
          <ul className="space-y-3">
            {filtered.map((p: Post) => {
              if (editingId === p.id) {
                return (
                  <li key={p.id} className="panel p-4 sm:p-5">
                    <p className="text-sm font-semibold text-ink mb-2">Edit post</p>
                    <textarea
                      id={`edit-${p.id}`}
                      defaultValue={p.text}
                      className="input w-full text-sm"
                      rows={4}
                      maxLength={MAX_CHARS}
                      style={{ resize: "none" }}
                    />
                    <div className="flex gap-2 justify-end mt-2">
                      <button onClick={() => setEditingId(null)} className="btn-secondary min-h-[44px]">
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const el = document.getElementById(`edit-${p.id}`) as HTMLTextAreaElement;
                          update.mutate(
                            { id: p.id, text: el.value },
                            { onSuccess: () => setEditingId(null) }
                          );
                        }}
                        disabled={update.isPending}
                        className="btn-primary min-h-[44px]"
                      >
                        {update.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </li>
                );
              }

              if (pendingDeleteId === p.id) {
                return (
                  <li key={p.id} className="panel p-4">
                    <div className="flex items-center gap-3 rounded bg-red-50 border border-red-200 p-3">
                      <span className="flex-1 text-sm text-red-900">Delete this post?</span>
                      <button
                        onClick={() => remove.mutate(p.id, { onSuccess: () => setPendingDeleteId(null) })}
                        disabled={remove.isPending}
                        className="btn-danger min-h-[44px]"
                      >
                        Confirm
                      </button>
                      <button onClick={() => setPendingDeleteId(null)} className="btn-secondary min-h-[44px]">
                        Cancel
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <PostCard
                  key={p.id}
                  p={p}
                  currentUserId={user?.id}
                  isLiked={likedPosts.has(p.id)}
                  onToggleLike={(id) => toggleLike.mutate(id)}
                  onEdit={setEditingId}
                  onDelete={setPendingDeleteId}
                />
              );
            })}
          </ul>

          {feedQuery.hasNextPage && (
            <div className="flex justify-center pb-4">
              <button
                onClick={() => feedQuery.fetchNextPage()}
                disabled={feedQuery.isFetchingNextPage}
                className="btn-secondary min-h-[44px] px-6"
              >
                {feedQuery.isFetchingNextPage ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" /> Loading…
                  </span>
                ) : (
                  "Load More"
                )}
              </button>
            </div>
          )}
        </>
      )}
      </ErrorBoundary>

    </div>
  );
}
