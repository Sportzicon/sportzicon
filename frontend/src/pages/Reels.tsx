import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { hasRole, isAdmin as checkAdmin } from "../utils/roles";
import { Spinner, EmptyState, PageHeader } from "../components/UI";
import { MobileDrawer } from "../components/MobileDrawer";
import { CommentSection } from "../components/CommentSection";
import { ReelViewer } from "../components/ReelViewer";
import { VideoUpload } from "../components/VideoUpload";
import { ImageUpload } from "../components/ImageUpload";
import { useAuthStore } from "../store/auth";
import { useReels } from "../hooks/useReels";
import { queryKeys } from "../hooks/queryKeys";
import { Trash2, Pencil, MessageCircle, Plus, X, Share2, Play, Volume2, VolumeX } from "lucide-react";
import type { Reel } from "../models";
import type { CreateReelRequest } from "../services/reel.service";

export default function Reels() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const { list, allReels, remove, update } = useReels();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<CreateReelRequest>({ title: "", video_url: "" });
  const [formErr, setFormErr] = useState<string | null>(null);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", sport: "" });
  const [commentReelId, setCommentReelId] = useState<string | null>(null);

  const canUpload = !!user;
  const isAdmin = checkAdmin(user?.role ?? "");

  const create = useMutation({
    mutationFn: () => api.post("/reels", form),
    onSuccess: () => {
      setUploadOpen(false);
      setForm({ title: "", video_url: "" });
      setFormErr(null);
      qc.invalidateQueries({ queryKey: queryKeys.reels() });
    },
    onError: (e) => setFormErr(humanizeError(e))
  });

  const openViewer = useCallback((idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  }, []);

  function openEditDrawer(r: Reel) {
    setEditingReel(r);
    setEditForm({
      title: r.title ?? r.caption ?? "",
      description: r.description ?? "",
      sport: r.sport ?? ""
    });
  }

  function handleEditSave() {
    if (!editingReel) return;
    update.mutate(
      { id: editingReel.id, title: editForm.title, description: editForm.description, sport: editForm.sport },
      { onSuccess: () => setEditingReel(null) }
    );
  }

  const commentReel = allReels.find((r) => r.id === commentReelId);

  return (
    <div className="pb-4">
      {/* ── Mobile: full-screen snap-scroll feed ── */}
      <div className="lg:hidden">
        {list.isLoading ? (
          <div className="flex justify-center items-center h-[calc(100svh-56px)]">
            <Spinner className="text-brand-500" />
          </div>
        ) : allReels.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No reels yet" hint="Post match highlights, training clips or technique breakdowns." />
          </div>
        ) : (
          <div
            className="h-[calc(100svh-56px)] overflow-y-scroll snap-y snap-mandatory"
            style={{ scrollbarWidth: "none" }}
          >
            {allReels.map((r, idx) => (
              <MobileReelSlide
                key={r.id}
                reel={r}
                idx={idx}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onComment={() => setCommentReelId(r.id)}
                onEdit={() => openEditDrawer(r)}
                onDelete={() => remove.mutate(r.id)}
              />
            ))}
            {list.hasNextPage && (
              <div className="h-[calc(100svh-56px)] snap-start flex items-center justify-center bg-black">
                <button
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                  className="btn-primary min-h-[44px] px-6"
                >
                  {list.isFetchingNextPage ? "Loading…" : "Load more reels"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* FAB upload button */}
        {canUpload && (
          <button
            onClick={() => setUploadOpen(true)}
            className="fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg min-h-[56px]"
            aria-label="Upload reel"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* ── Desktop: grid ── */}
      <div className="hidden lg:block space-y-6 p-6">
        <PageHeader
          title="Reels"
          subtitle="Highlights · drills · technique"
          sticky
          action={
            canUpload ? (
              <button className="btn-accent min-h-[44px]" onClick={() => setUploadOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Post a reel
              </button>
            ) : undefined
          }
        />

        {list.isLoading ? (
          <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
        ) : allReels.length === 0 ? (
          <EmptyState title="No reels yet" hint="Post match highlights, training clips or technique breakdowns." />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {allReels.map((r, idx) => (
                <DesktopReelCard
                  key={r.id}
                  reel={r}
                  currentUserId={user?.id}
                  isAdmin={isAdmin}
                  onOpen={() => openViewer(idx)}
                  onEdit={() => openEditDrawer(r)}
                  onDelete={() => remove.mutate(r.id)}
                />
              ))}
            </div>
            {list.hasNextPage && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                  className="btn-secondary min-h-[44px] px-8"
                >
                  {list.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Upload drawer (mobile only — desktop uses the modal below) ── */}
      <div className="lg:hidden">
        <MobileDrawer
          isOpen={uploadOpen}
          onClose={() => setUploadOpen(false)}
          title="Post a Reel"
        >
          <UploadForm
            form={form}
            setForm={setForm}
            formErr={formErr}
            onSubmit={() => create.mutate()}
            onCancel={() => setUploadOpen(false)}
            isPending={create.isPending}
          />
        </MobileDrawer>
      </div>

      {/* ── Desktop upload modal ── */}
      {uploadOpen && (
        <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center bg-black/60" onClick={() => setUploadOpen(false)}>
          <div className="bg-panel rounded-2xl shadow-card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-disp text-xl text-ink">Post a Reel</h2>
              <button onClick={() => setUploadOpen(false)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <UploadForm
              form={form}
              setForm={setForm}
              formErr={formErr}
              onSubmit={() => create.mutate()}
              onCancel={() => setUploadOpen(false)}
              isPending={create.isPending}
            />
          </div>
        </div>
      )}

      {/* ── Full-screen viewer (desktop) ── */}
      {viewerOpen && allReels.length > 0 && (
        <ReelViewer
          reels={allReels}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* ── Edit drawer (mobile only — desktop uses the modal below) ── */}
      <div className="lg:hidden">
        <MobileDrawer
          isOpen={!!editingReel}
          onClose={() => setEditingReel(null)}
          title="Edit Reel"
          footer={
            <div className="flex gap-2 p-3">
              <button onClick={() => setEditingReel(null)} className="btn-secondary flex-1 min-h-[44px]">Cancel</button>
              <button onClick={handleEditSave} disabled={update.isPending || !editForm.title.trim()} className="btn-primary flex-1 min-h-[44px]">
                {update.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          }
        >
          <EditReelFields editForm={editForm} setEditForm={setEditForm} />
        </MobileDrawer>
      </div>

      {/* ── Desktop edit modal ── */}
      {editingReel && (
        <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center bg-black/60" onClick={() => setEditingReel(null)}>
          <div className="bg-panel rounded-2xl shadow-card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-disp text-xl text-ink">Edit Reel</h2>
              <button onClick={() => setEditingReel(null)} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <EditReelFields editForm={editForm} setEditForm={setEditForm} />
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditingReel(null)} className="btn-secondary flex-1 min-h-[44px]">Cancel</button>
              <button onClick={handleEditSave} disabled={update.isPending || !editForm.title.trim()} className="btn-primary flex-1 min-h-[44px]">
                {update.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Comments drawer (mobile only — desktop comments live inside ReelViewer) ── */}
      <div className="lg:hidden">
        <MobileDrawer
          isOpen={!!commentReelId}
          onClose={() => setCommentReelId(null)}
          title={commentReel ? `Comments on "${commentReel.title ?? commentReel.caption ?? "Reel"}"` : "Comments"}
        >
          {commentReelId && (
            <CommentSection
              parentType="reel"
              parentId={commentReelId}
              commentCount={commentReel?.comment_count ?? 0}
              inDrawer
            />
          )}
        </MobileDrawer>
      </div>
    </div>
  );
}

function EditReelFields({
  editForm, setEditForm
}: {
  editForm: { title: string; description: string; sport: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; sport: string }>>;
}) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">Title *</span>
        <input className="input min-h-[44px]" maxLength={100} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
      </label>
      <label className="block">
        <span className="label">Description</span>
        <textarea className="input min-h-[80px] resize-none" maxLength={500} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
      </label>
      <label className="block">
        <span className="label">Sport</span>
        <input className="input min-h-[44px]" value={editForm.sport} onChange={(e) => setEditForm((f) => ({ ...f, sport: e.target.value }))} />
      </label>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function MobileReelSlide({
  reel, idx, currentUserId, isAdmin,
  onComment, onEdit, onDelete
}: {
  reel: Reel; idx: number;
  currentUserId?: string; isAdmin: boolean;
  onComment(): void; onEdit(): void; onDelete(): void;
}) {
  const canManage = reel.author_id === currentUserId || isAdmin;
  const displayTitle = reel.title ?? reel.caption;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = isMuted;
  }, [isMuted]);

  // Play when scrolled into view, pause when scrolled away
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
          video.pause();
          setIsPlaying(false);
        }
      },
      { threshold: 0.6 }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [reel.video_url]);

  function togglePlay(e: React.MouseEvent) {
    // Don't toggle when clicking action buttons
    if ((e.target as HTMLElement).closest("button")) return;
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/reels`;
    const shareData = {
      title: displayTitle ?? "Check out this reel on Sportivox",
      text: reel.description
        ? `${reel.description} — ${reel.author?.full_name ?? ""} on Sportivox`
        : `${reel.author?.full_name ?? ""} posted a reel on Sportivox`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch {
      // user cancelled native share — no action needed
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100svh-56px)] snap-start overflow-hidden bg-black flex items-center justify-center"
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        className="h-full w-full object-contain"
        playsInline
        loop
        preload="metadata"
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      {/* Centre play icon when paused */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/40 rounded-full p-5">
            <Play className="h-10 w-10 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Right action bar */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-4 items-center">
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted((m) => !m); }}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX className="h-7 w-7 text-white drop-shadow" /> : <Volume2 className="h-7 w-7 text-white drop-shadow" />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onComment(); }}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
        >
          <MessageCircle className="h-7 w-7 text-white drop-shadow" />
          <span className="text-white text-xs font-medium drop-shadow">{reel.comment_count}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
          aria-label="Share reel"
        >
          <Share2 className="h-7 w-7 text-white drop-shadow" />
          <span className="text-white text-xs font-medium drop-shadow">Share</span>
        </button>
        {canManage && (
          <>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Pencil className="h-5 w-5 text-white/70 drop-shadow" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Trash2 className="h-5 w-5 text-red-400 drop-shadow" />
            </button>
          </>
        )}
      </div>

      {/* Bottom author + info */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <p className="text-white font-semibold text-sm drop-shadow">
          {reel.author?.full_name ?? reel.author_name ?? "Unknown"}
        </p>
        {displayTitle && (
          <p className="text-white/90 text-sm mt-1 line-clamp-2 drop-shadow">{displayTitle}</p>
        )}
        {reel.sport && (
          <span className="inline-block mt-1.5 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
            {reel.sport}
          </span>
        )}
      </div>

      {/* Share toast (clipboard fallback) */}
      {shareToast && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
          Link copied!
        </div>
      )}

      <span className="absolute top-3 right-3 text-white/50 text-xs">#{idx + 1}</span>
    </div>
  );
}

function DesktopReelCard({
  reel, currentUserId, isAdmin,
  onOpen, onEdit, onDelete
}: {
  reel: Reel;
  currentUserId?: string; isAdmin: boolean;
  onOpen(): void; onEdit(): void; onDelete(): void;
}) {
  const canManage = reel.author_id === currentUserId || isAdmin;
  const displayTitle = reel.title ?? reel.caption;
  const [shareToast, setShareToast] = useState(false);

  async function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/reels`;
    const shareData = {
      title: displayTitle ?? "Check out this reel on Sportivox",
      text: reel.description
        ? `${reel.description} — ${reel.author?.full_name ?? ""} on Sportivox`
        : `${reel.author?.full_name ?? ""} posted a reel on Sportivox`,
      url,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      }
    } catch {
      // user cancelled
    }
  }

  return (
    <div className="group panel overflow-hidden relative">
      <div
        onClick={onOpen}
        className="relative aspect-[9/16] cursor-pointer overflow-hidden bg-ink"
      >
        <video
          src={reel.video_url}
          poster={reel.thumbnail_url ?? undefined}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          muted
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3">
            <Play className="h-6 w-6 text-black fill-black" />
          </div>
        </div>
        {reel.sport && (
          <span className="absolute top-2 left-2 badge bg-ink/70 text-paper border-transparent text-xs">{reel.sport}</span>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3 text-white text-xs">
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {reel.comment_count}</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="font-semibold text-sm text-ink truncate">
          {reel.author?.full_name ?? reel.author_name ?? "Unknown"}
        </div>
        {displayTitle && <p className="text-ink-70 text-xs line-clamp-2">{displayTitle}</p>}
        <div className="flex items-center gap-2 pt-1 border-t border-hairsoft">
          <button
            onClick={handleShare}
            className="flex items-center gap-1 text-xs min-h-[44px] text-ink-sub hover:text-brand-500 transition"
            title="Share reel"
          >
            <Share2 className="h-4 w-4" />
          </button>
          {canManage && (
            <>
              <button onClick={onEdit} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink transition ml-auto">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={onDelete} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-red-600 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {shareToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none z-10">
          Link copied!
        </div>
      )}
    </div>
  );
}

function UploadForm({
  form, setForm, formErr,
  onSubmit, onCancel, isPending
}: {
  form: CreateReelRequest;
  setForm: React.Dispatch<React.SetStateAction<CreateReelRequest>>;
  formErr: string | null;
  onSubmit(): void;
  onCancel(): void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Video upload */}
      <div className="space-y-2">
        <span className="label">Video *</span>
        <VideoUpload
          value={form.video_url}
          onChange={(url) => setForm((f) => ({ ...f, video_url: url }))}
        />
      </div>

      {/* Title */}
      <label className="block">
        <span className="label">Title *</span>
        <input
          className="input min-h-[44px]"
          placeholder="e.g. Match-winning six at Eden Gardens"
          maxLength={100}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <span className="text-xs text-ink-faint">{form.title.length}/100</span>
      </label>

      {/* Description */}
      <label className="block">
        <span className="label">Description</span>
        <textarea
          className="input min-h-[80px] resize-none"
          placeholder="Describe this clip…"
          maxLength={500}
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <span className="text-xs text-ink-faint">{(form.description ?? "").length}/500</span>
      </label>

      {/* Sport */}
      <label className="block">
        <span className="label">Sport</span>
        <input
          className="input min-h-[44px]"
          placeholder="e.g. Cricket"
          value={form.sport ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
        />
      </label>

      {/* Thumbnail */}
      <ImageUpload
        label="Thumbnail (optional)"
        context="post"
        aspectRatio="16/9"
        value={form.thumbnail_url}
        onChange={(url) => setForm((f) => ({ ...f, thumbnail_url: url }))}
      />

      {formErr && <div className="text-sm text-red-700 rounded-lg bg-red-50 p-3">{formErr}</div>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn-secondary flex-1 min-h-[44px]"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1 min-h-[44px]"
          disabled={isPending || !form.video_url || !form.title.trim()}
          onClick={onSubmit}
        >
          {isPending ? "Posting…" : "Post reel →"}
        </button>
      </div>
    </div>
  );
}
