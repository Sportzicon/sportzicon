import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { useFeed } from "../../../hooks";
import { useAuthStore } from "../../../store/auth";
import { PageHeader, Spinner, EmptyState, Avatar, Tabs, Badge, Placeholder } from "../../../components/UI";
import { CommentSection } from "../../comments/components/CommentSection";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { CreateContentModal } from "../../../components/CreateContentModal";
import { ReelViewer } from "../../reels/components/ReelViewer";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, RefreshCw, PenLine, Play, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PostComposer } from "../components/PostComposer";
import { PostContentView } from "../components/PostContentView";
import { MediaCarousel } from "../components/MediaCarousel";
import { toFeedItem } from "../../../models";
import type { Post, Blog, Reel, FeedItem } from "../../../models";

// Web Share API with clipboard fallback — same pattern as ReelViewer's handleShare.
function useContentShare() {
  const [toast, setToast] = useState(false);
  const share = useCallback(async (url: string, title: string, text: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    const shareData = { title, text, url: fullUrl };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(fullUrl);
        setToast(true);
        setTimeout(() => setToast(false), 2000);
      }
    } catch {
      // user cancelled
    }
  }, []);
  return { toast, share };
}

function ShareButton({ onShare }: { onShare: () => void }) {
  return (
    <button
      onClick={onShare}
      className="font-mononum text-[11.5px] flex items-center gap-1.5 text-ink-sub hover:text-brand-500 transition min-h-[44px] ml-auto"
      aria-label="Share"
    >
      <Share2 className="h-4 w-4" /> Share
    </button>
  );
}

function ShareToast() {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[12px] px-3 py-1.5 rounded-full pointer-events-none z-10">
      Link copied!
    </div>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = currentUserId === p.author_id;
  const { toast: shareToast, share } = useContentShare();

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
    <li className="panel p-4 sm:p-5 relative">
      {shareToast && <ShareToast />}
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
              {isOwner ? "You" : p.author_name}
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
          {p.sport && <div className="lab mt-0.5">{p.sport}</div>}
        </div>
      </div>

      {/* Post content */}
      <div className="mt-3">
        <PostContentView content={p.content_json} />
      </div>

      <MediaCarousel media={p.media} />

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
        <ShareButton
          onShare={() =>
            share(
              "/feed",
              p.author_name ? `${p.author_name} on Sportivox` : "Check out this post on Sportivox",
              "Shared from Sportivox"
            )
          }
        />
      </div>

      <CommentSection parentType="post" parentId={p.id} commentCount={p.comment_count} startCollapsed />
    </li>
  );
}

// Article card — fully readable in place (title, cover, body, likes, comments),
// no navigation required. Collapsed state shows the excerpt; "Read more" swaps
// in the full markdown body, matching an Instagram/LinkedIn in-feed read.
function BlogCard({
  b,
  currentUserId,
  isLiked,
  onToggleLike,
}: {
  b: Blog;
  currentUserId?: string;
  isLiked: boolean;
  onToggleLike: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { toast: shareToast, share } = useContentShare();

  return (
    <li className="panel p-4 sm:p-5 relative">
      {shareToast && <ShareToast />}
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Link to={`/profile/${b.author_id}`}>
          <Avatar name={b.author_name ?? ""} src={b.author?.profile_photo_url} size={40} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/profile/${b.author_id}`}
            className="text-[13.5px] font-semibold text-ink hover:text-brand-500 truncate"
          >
            {currentUserId === b.author_id ? "You" : b.author_name}
          </Link>
          <div className="lab mt-0.5">
            {new Date(b.created_at).toLocaleDateString()}{b.sport ? ` · ${b.sport}` : ""}
          </div>
        </div>
        <Badge color="amber">Article</Badge>
      </div>

      <div className="font-disp text-[18px] leading-tight mt-3">{b.title}</div>

      {b.cover_image_url && (
        <img src={b.cover_image_url} alt="" className="mt-3 w-full aspect-video object-cover rounded-lg" />
      )}

      <div className="mt-3 text-[13.5px] text-ink-70 leading-relaxed">
        {expanded ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{b.body_markdown}</ReactMarkdown>
          </div>
        ) : (
          <p>{b.excerpt}</p>
        )}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 text-brand-500 text-[13px] font-semibold hover:underline min-h-[44px]"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      </div>

      {/* Like / Comment row */}
      <div className="mt-4 pt-3 border-t border-hairsoft flex items-center gap-5">
        <button
          onClick={() => onToggleLike(b.id)}
          className={`font-mononum text-[11.5px] flex items-center gap-1.5 transition min-h-[44px] ${
            isLiked ? "text-brand-500" : "text-ink-sub hover:text-brand-500"
          }`}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <Heart className="h-4 w-4" fill={isLiked ? "currentColor" : "none"} />
          {b.like_count}
        </button>
        <ShareButton onShare={() => share(`/blogs/${b.id}`, b.title, b.excerpt)} />
      </div>

      <CommentSection parentType="blog" parentId={b.id} commentCount={b.comment_count} startCollapsed />
    </li>
  );
}

function ReelCard({ r, onOpen }: { r: Reel; onOpen: () => void }) {
  const { toast: shareToast, share } = useContentShare();

  return (
    <li className="panel p-4 sm:p-5 relative">
      {shareToast && <ShareToast />}
      <button onClick={onOpen} className="block w-full text-left">
        <Badge color="emerald">Video</Badge>
        <div className="mt-2.5 flex gap-3">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-ink">
            {r.thumbnail_url ? (
              <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <Placeholder height={80} />
            )}
            <span className="absolute inset-0 flex items-center justify-center text-white/80">
              <Play className="h-5 w-5" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] text-ink-70 line-clamp-3">{r.caption || r.title || "Video"}</p>
          </div>
        </div>
      </button>
      <div className="mt-3 pt-3 border-t border-hairsoft flex items-center gap-5 text-ink-sub">
        <span className="font-mononum text-[11.5px] flex items-center gap-1.5"><Heart className="h-4 w-4" /> {r.like_count}</span>
        <span className="font-mononum text-[11.5px] flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> {r.comment_count}</span>
        <ShareButton onShare={() => share("/feed", r.title ?? "Check out this video on Sportivox", r.caption ?? r.description ?? "Shared from Sportivox")} />
      </div>
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
  const { feedQuery, items, update, remove, toggleLike, likedPosts } = useFeed();
  const [tab, setTab] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const touchStartY = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const feedItems: FeedItem[] = useMemo(() => items.map(toFeedItem), [items]);

  const filtered = tab === "Posts"
    ? feedItems.filter((f) => f.kind === "post")
    : tab === "Articles"
    ? feedItems.filter((f) => f.kind === "blog")
    : tab === "Videos"
    ? feedItems.filter((f) => f.kind === "reel")
    : feedItems;

  const reelsInView = useMemo(
    () => filtered.filter((f) => f.kind === "reel").map((f) => f.data as Reel),
    [filtered]
  );

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

  return (
    <div
      ref={feedRef}
      className="max-w-2xl space-y-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PageHeader title="Catch" subtitle="Your network" />

      <PullIndicator distance={pullDistance} isRefreshing={isRefreshing} />

      {/* Create trigger */}
      <button
        onClick={() => setCreateOpen(true)}
        className="panel w-full flex items-center gap-3 p-4 min-h-[44px]"
        aria-label="Create"
      >
        <Avatar name={user?.full_name ?? ""} src={user?.profile_photo_url} size={36} accent />
        <span className="flex-1 text-left text-sm text-ink-faint bg-fill rounded-full px-4 py-2">
          Share an update…
        </span>
        <PenLine className="h-5 w-5 text-ink-faint" />
      </button>
      <CreateContentModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Tabs tabs={["All", "Posts", "Articles", "Videos"]} active={tab} onChange={setTab} sticky />

      <ErrorBoundary>
      {feedQuery.isLoading ? (
        <div className="panel p-8 flex justify-center">
          <Spinner className="text-brand-500" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" hint="Follow people or share your first update." />
      ) : (
        <>
          <ul className="space-y-3">
            {filtered.map((item) => {
              if (item.kind === "blog") {
                return (
                  <BlogCard
                    key={`blog-${item.data.id}`}
                    b={item.data}
                    currentUserId={user?.id}
                    isLiked={likedPosts.has(item.data.id)}
                    onToggleLike={(id) => toggleLike.mutate(id)}
                  />
                );
              }

              if (item.kind === "reel") {
                const r = item.data;
                return (
                  <ReelCard
                    key={`reel-${r.id}`}
                    r={r}
                    onOpen={() => setViewerIndex(reelsInView.findIndex((rr) => rr.id === r.id))}
                  />
                );
              }

              const p = item.data;

              if (editingId === p.id) {
                return (
                  <li key={p.id} className="panel p-4 sm:p-5">
                    <p className="text-sm font-semibold text-ink mb-2">Edit post</p>
                    <PostComposer
                      initialContentJson={p.content_json}
                      initialMedia={p.media}
                      submitting={update.isPending}
                      submitLabel="Save"
                      onSubmit={(data) =>
                        update.mutate(
                          { id: p.id, content_json: data.content_json, media: data.media },
                          { onSuccess: () => setEditingId(null) }
                        )
                      }
                      onCancel={() => setEditingId(null)}
                    />
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

      {viewerIndex !== null && reelsInView.length > 0 && (
        <ReelViewer
          reels={reelsInView}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </div>
  );
}
