import { useState, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { hasRole, isAdmin as checkAdmin } from "../utils/roles";
import { Spinner, EmptyState } from "../components/UI";
import { MobileDrawer } from "../components/MobileDrawer";
import { CommentSection } from "../components/CommentSection";
import { ReelViewer } from "../components/ReelViewer";
import { useAuthStore } from "../store/auth";
import { useFavoritesStore } from "../store/favorites";
import { useReels } from "../hooks/useReels";
import { queryKeys } from "../hooks/queryKeys";
import { Heart, Trash2, Pencil, MessageCircle, Eye, Bookmark, Plus, Upload, X } from "lucide-react";
import type { Reel } from "../models";
import type { CreateReelRequest } from "../services/reel.service";

interface UploadState {
  progress: number;
  fileSize: number;
  phase: "video" | "thumbnail" | null;
}

export default function Reels() {
  const user = useAuthStore((s) => s.user);
  const { favoriteReels, toggleFavoriteReel } = useFavoritesStore();
  const qc = useQueryClient();

  const { list, allReels, toggleLike, likedReels, remove, update } = useReels();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<CreateReelRequest>({ title: "", video_url: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>({ progress: 0, fileSize: 0, phase: null });

  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", sport: "" });
  const [commentReelId, setCommentReelId] = useState<string | null>(null);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const canUpload = hasRole(user?.role ?? "", "athlete");
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

  async function uploadMedia(file: File, category: "video" | "image"): Promise<string | null> {
    setUpload({ progress: 0, fileSize: file.size, phase: category === "video" ? "video" : "thumbnail" });
    setFormErr(null);

    try {
      const { data: urlData } = await api.post("/media/upload-url", {
        category,
        filename: file.name,
        content_type: file.type,
        content_length: file.size
      });

      const publicUrl: string = urlData.public_url;
      const uploadUrl: string = urlData.upload_url;
      const headers: Record<string, string> = urlData.headers ?? {};

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) setUpload((u) => ({ ...u, progress: Math.round((e.loaded / e.total) * 100) }));
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed: ${xhr.status}`));
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.open("PUT", uploadUrl);
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.send(file);
      });

      return publicUrl;
    } catch (e) {
      setFormErr(humanizeError(e));
      return null;
    } finally {
      setUpload({ progress: 0, fileSize: 0, phase: null });
    }
  }

  async function handleVideoFile(file: File) {
    if (file.size > 200 * 1024 * 1024) {
      setFormErr(`Video must be under 200MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
      return;
    }
    const url = await uploadMedia(file, "video");
    if (url) setForm((f) => ({ ...f, video_url: url }));
  }

  async function handleThumbFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setFormErr(`Thumbnail must be under 10MB.`);
      return;
    }
    const url = await uploadMedia(file, "image");
    if (url) setForm((f) => ({ ...f, thumbnail_url: url }));
  }

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
          <div className="flex justify-center items-center h-[80vh]">
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
                isLiked={likedReels.has(r.id)}
                isFavorite={favoriteReels.has(r.id)}
                currentUserId={user?.id}
                isAdmin={isAdmin}
                onLike={() => toggleLike.mutate(r.id)}
                onFavorite={() => toggleFavoriteReel(r.id)}
                onComment={() => setCommentReelId(r.id)}
                onEdit={() => openEditDrawer(r)}
                onDelete={() => remove.mutate(r.id)}
              />
            ))}
            {list.hasNextPage && (
              <div className="h-screen snap-start flex items-center justify-center bg-black">
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
            className="fixed bottom-[calc(56px+env(safe-area-inset-bottom)+16px)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg min-h-[56px]"
            aria-label="Upload reel"
          >
            <Plus className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* ── Desktop: 3-column grid ── */}
      <div className="hidden lg:block space-y-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-disp text-2xl text-ink">Reels</h1>
            <p className="text-sm text-ink-sub mt-1">Highlights · drills · technique</p>
          </div>
          {canUpload && (
            <button className="btn-accent min-h-[44px]" onClick={() => setUploadOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Post a reel
            </button>
          )}
        </div>

        {list.isLoading ? (
          <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
        ) : allReels.length === 0 ? (
          <EmptyState title="No reels yet" hint="Post match highlights, training clips or technique breakdowns." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allReels.map((r, idx) => (
                <DesktopReelCard
                  key={r.id}
                  reel={r}
                  idx={idx}
                  isLiked={likedReels.has(r.id)}
                  isFavorite={favoriteReels.has(r.id)}
                  currentUserId={user?.id}
                  isAdmin={isAdmin}
                  onOpen={() => openViewer(idx)}
                  onLike={() => toggleLike.mutate(r.id)}
                  onFavorite={() => toggleFavoriteReel(r.id)}
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

      {/* ── Upload drawer / modal ── */}
      <MobileDrawer
        isOpen={uploadOpen}
        onClose={() => { if (upload.phase === null) setUploadOpen(false); }}
        title="Post a Reel"
      >
        <UploadForm
          form={form}
          setForm={setForm}
          upload={upload}
          formErr={formErr}
          setFormErr={setFormErr}
          videoInputRef={videoInputRef}
          thumbInputRef={thumbInputRef}
          onVideoFile={handleVideoFile}
          onThumbFile={handleThumbFile}
          onSubmit={() => create.mutate()}
          onCancel={() => setUploadOpen(false)}
          isPending={create.isPending}
        />
      </MobileDrawer>

      {/* ── Desktop upload modal ── */}
      {uploadOpen && (
        <div className="hidden lg:flex fixed inset-0 z-50 items-center justify-center bg-black/60" onClick={() => { if (upload.phase === null) setUploadOpen(false); }}>
          <div className="bg-panel rounded-2xl shadow-card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-disp text-xl text-ink">Post a Reel</h2>
              <button onClick={() => { if (upload.phase === null) setUploadOpen(false); }} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <UploadForm
              form={form}
              setForm={setForm}
              upload={upload}
              formErr={formErr}
              setFormErr={setFormErr}
              videoInputRef={videoInputRef}
              thumbInputRef={thumbInputRef}
              onVideoFile={handleVideoFile}
              onThumbFile={handleThumbFile}
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
          onLike={(id) => toggleLike.mutate(id)}
          onAddToFavorites={(id) => toggleFavoriteReel(id)}
          onCommentClick={(id) => setCommentReelId(id)}
          likedReels={likedReels}
          favoriteReels={favoriteReels}
        />
      )}

      {/* ── Edit drawer ── */}
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
      </MobileDrawer>

      {/* ── Comments drawer ── */}
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
          />
        )}
      </MobileDrawer>
    </div>
  );
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function MobileReelSlide({
  reel, idx, isLiked, isFavorite, currentUserId, isAdmin,
  onLike, onFavorite, onComment, onEdit, onDelete
}: {
  reel: Reel; idx: number; isLiked: boolean; isFavorite: boolean;
  currentUserId?: string; isAdmin: boolean;
  onLike(): void; onFavorite(): void; onComment(): void; onEdit(): void; onDelete(): void;
}) {
  const canManage = reel.author_id === currentUserId || isAdmin;
  const displayTitle = reel.title ?? reel.caption;

  return (
    <div className="relative h-screen snap-start overflow-hidden bg-black flex items-center justify-center">
      <video
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        className="h-full w-full object-cover"
        muted
        playsInline
        loop
      />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      {/* Right action bar */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-4 items-center">
        <button
          onClick={onLike}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
        >
          <Heart className="h-7 w-7 text-white drop-shadow" fill={isLiked ? "#ef4444" : "none"} stroke={isLiked ? "#ef4444" : "white"} />
          <span className="text-white text-xs font-medium drop-shadow">{reel.like_count}</span>
        </button>
        <button
          onClick={onComment}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
        >
          <MessageCircle className="h-7 w-7 text-white drop-shadow" />
          <span className="text-white text-xs font-medium drop-shadow">{reel.comment_count}</span>
        </button>
        <button
          onClick={onFavorite}
          className="flex flex-col items-center gap-1 min-h-[56px] min-w-[56px] justify-center"
        >
          <Bookmark className="h-7 w-7 text-white drop-shadow" fill={isFavorite ? "#eab308" : "none"} stroke={isFavorite ? "#eab308" : "white"} />
        </button>
        <div className="flex flex-col items-center gap-1 min-h-[44px] min-w-[44px] justify-center">
          <Eye className="h-6 w-6 text-white/70 drop-shadow" />
          <span className="text-white/70 text-xs font-medium drop-shadow">{reel.view_count}</span>
        </div>
        {canManage && (
          <>
            <button onClick={onEdit} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Pencil className="h-5 w-5 text-white/70 drop-shadow" />
            </button>
            <button onClick={onDelete} className="min-h-[44px] min-w-[44px] flex items-center justify-center">
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

      <span className="absolute top-3 right-3 text-white/50 text-xs">#{idx + 1}</span>
    </div>
  );
}

function DesktopReelCard({
  reel, isLiked, isFavorite, currentUserId, isAdmin,
  onOpen, onLike, onFavorite, onEdit, onDelete
}: {
  reel: Reel; idx: number; isLiked: boolean; isFavorite: boolean;
  currentUserId?: string; isAdmin: boolean;
  onOpen(): void; onLike(): void; onFavorite(): void; onEdit(): void; onDelete(): void;
}) {
  const canManage = reel.author_id === currentUserId || isAdmin;
  const displayTitle = reel.title ?? reel.caption;

  return (
    <div className="group panel overflow-hidden">
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
            <svg className="h-6 w-6 text-black" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        </div>
        {reel.sport && (
          <span className="absolute top-2 left-2 badge bg-ink/70 text-paper border-transparent text-xs">{reel.sport}</span>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-3 text-white text-xs">
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {reel.like_count}</span>
            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {reel.comment_count}</span>
            <span className="flex items-center gap-1 ml-auto"><Eye className="h-3 w-3" /> {reel.view_count}</span>
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
            onClick={onLike}
            className={`flex items-center gap-1 text-xs min-h-[44px] transition ${isLiked ? "text-red-500" : "text-ink-sub hover:text-red-500"}`}
          >
            <Heart className="h-4 w-4" fill={isLiked ? "currentColor" : "none"} /> {reel.like_count}
          </button>
          <button
            onClick={onFavorite}
            className={`flex items-center gap-1 text-xs min-h-[44px] ml-auto transition ${isFavorite ? "text-yellow-500" : "text-ink-sub hover:text-yellow-500"}`}
          >
            <Bookmark className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
          {canManage && (
            <>
              <button onClick={onEdit} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink transition">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={onDelete} className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-red-600 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function UploadForm({
  form, setForm, upload, formErr, setFormErr,
  videoInputRef, thumbInputRef,
  onVideoFile, onThumbFile,
  onSubmit, onCancel, isPending
}: {
  form: CreateReelRequest;
  setForm: React.Dispatch<React.SetStateAction<CreateReelRequest>>;
  upload: UploadState;
  formErr: string | null;
  setFormErr: (e: string | null) => void;
  videoInputRef: React.RefObject<HTMLInputElement>;
  thumbInputRef: React.RefObject<HTMLInputElement>;
  onVideoFile(f: File): void;
  onThumbFile(f: File): void;
  onSubmit(): void;
  onCancel(): void;
  isPending: boolean;
}) {
  const isUploading = upload.phase !== null;

  return (
    <div className="space-y-4">
      {/* Video upload */}
      <div className="space-y-2">
        <span className="label">Video *</span>
        {form.video_url ? (
          <div className="border border-green-300 rounded-lg bg-green-50 p-3 flex items-center justify-between">
            <span className="text-sm text-green-900 font-medium">✓ Video uploaded</span>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, video_url: "" }))}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 min-h-[44px] hover:bg-red-200 transition"
            >
              Remove
            </button>
          </div>
        ) : upload.phase === "video" ? (
          <div className="border-2 border-dashed border-brand-300 rounded-lg p-6 bg-brand-50 space-y-3 text-center">
            <Upload className="h-8 w-8 text-brand-500 mx-auto" />
            <p className="text-sm font-medium text-brand-900">Uploading…</p>
            <div className="w-full bg-brand-200 rounded h-2 overflow-hidden">
              <div className="bg-brand-500 h-full transition-all" style={{ width: `${upload.progress}%` }} />
            </div>
            <p className="text-xs text-brand-700">{upload.progress}% · {(upload.fileSize / 1024 / 1024).toFixed(1)} MB</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-hair rounded-lg p-6 text-center text-ink-sub hover:border-brand-400 hover:text-brand-500 transition min-h-[80px] flex flex-col items-center justify-center gap-2"
          >
            <Upload className="h-6 w-6" />
            <span className="text-sm font-medium">Tap to select video</span>
            <span className="text-xs">MP4, WebM, MOV · max 200MB</span>
          </button>
        )}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onVideoFile(f); e.target.value = ""; }}
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
      <div className="space-y-2">
        <span className="label">Thumbnail (optional)</span>
        {form.thumbnail_url ? (
          <div className="border border-green-300 rounded-lg bg-green-50 p-3 flex items-center gap-3">
            <img src={form.thumbnail_url} alt="Thumbnail" className="h-14 w-14 object-cover rounded" />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, thumbnail_url: undefined }))}
              className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 min-h-[44px] hover:bg-red-200 transition ml-auto"
            >
              Remove
            </button>
          </div>
        ) : upload.phase === "thumbnail" ? (
          <div className="space-y-2 p-3 border rounded-lg">
            <div className="w-full bg-fill rounded h-2 overflow-hidden">
              <div className="bg-brand-500 h-full transition-all" style={{ width: `${upload.progress}%` }} />
            </div>
            <p className="text-xs text-ink-faint">{upload.progress}%</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => thumbInputRef.current?.click()}
            disabled={isUploading}
            className="btn-secondary w-full min-h-[44px]"
          >
            Upload thumbnail
          </button>
        )}
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onThumbFile(f); e.target.value = ""; }}
        />
      </div>

      {formErr && <div className="text-sm text-red-700 rounded-lg bg-red-50 p-3">{formErr}</div>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn-secondary flex-1 min-h-[44px]"
          onClick={onCancel}
          disabled={isUploading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary flex-1 min-h-[44px]"
          disabled={isPending || !form.video_url || !form.title.trim() || isUploading}
          onClick={onSubmit}
        >
          {isPending ? "Posting…" : isUploading ? "Uploading…" : "Post reel →"}
        </button>
      </div>
    </div>
  );
}
