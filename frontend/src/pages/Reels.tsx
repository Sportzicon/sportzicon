import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { hasRole } from "../utils/roles";
import { PageHeader, Spinner, EmptyState } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { ReelViewer } from "../components/ReelViewer";
import { useAuthStore } from "../store/auth";
import { useFavoritesStore } from "../store/favorites";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, Eye, Bookmark, Award, Upload } from "lucide-react";
import type { Reel } from "../types";

export default function Reels() {
  const user = useAuthStore((s) => s.user);
  const { favoriteReels, toggleFavoriteReel } = useFavoritesStore();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ video_url: "", thumbnail_url: "", caption: "", sport: "" });
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [flaggedReelId, setFlaggedReelId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"video" | "thumbnail" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileSize, setUploadFileSize] = useState(0);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin";
  const canUpload = hasRole(user?.role ?? "", "athlete");

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["reels"],
    queryFn: async () => (await api.get<{ items: Reel[] }>("/reels", { params: { limit: 50 } })).data.items
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
      return api.post("/reels", payload);
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ video_url: "", thumbnail_url: "", caption: "", sport: "" });
      qc.invalidateQueries({ queryKey: ["reels"] });
    },
    onError: (e) => setErr(humanizeError(e))
  });

  const update = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => api.put(`/reels/${id}`, { caption }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reels"] }); setEditingId(null); }
  });

  const deleteReel = useMutation({
    mutationFn: async (id: string) => api.delete(`/reels/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reels"] }); setPendingDeleteId(null); }
  });

  const like = useMutation({
    mutationFn: async (id: string) => {
      if (likedReels.has(id)) return api.delete(`/reels/${id}/like`);
      return api.post(`/reels/${id}/like`);
    },
    onMutate: (id: string) => {
      setLikedReels((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onError: (_err, id) => {
      setLikedReels((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reels"] })
  });

  const flagReel = useMutation({
    mutationFn: async (id: string) => api.post(`/reels/${id}/report`, { reason: "inappropriate" }),
    onSuccess: () => { setFlaggedReelId(null); qc.invalidateQueries({ queryKey: ["reels"] }); }
  });

  async function uploadVideo(file: File) {
    setUploading("video");
    setUploadProgress(0);
    setUploadFileSize(file.size);
    setErr(null);
    try {
      // Upload directly to backend as binary
      const buffer = await file.arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const res = JSON.parse(xhr.responseText);
            setForm((f) => ({ ...f, video_url: res.public_url }));
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        const token = useAuthStore.getState().accessToken;
        xhr.open("POST", `${api.defaults.baseURL}/media/upload?category=video&filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type)}`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(buffer);
      });
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setUploading(null);
      setUploadProgress(0);
      setUploadFileSize(0);
    }
  }

  async function uploadThumbnail(file: File) {
    setUploading("thumbnail");
    setUploadProgress(0);
    setUploadFileSize(file.size);
    setErr(null);
    try {
      // Upload directly to backend as binary
      const buffer = await file.arrayBuffer();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const res = JSON.parse(xhr.responseText);
            setForm((f) => ({ ...f, thumbnail_url: res.public_url }));
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        const token = useAuthStore.getState().accessToken;
        xhr.open("POST", `${api.defaults.baseURL}/media/upload?category=image&filename=${encodeURIComponent(file.name)}&content_type=${encodeURIComponent(file.type)}`);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.send(buffer);
      });
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setUploading(null);
      setUploadProgress(0);
      setUploadFileSize(0);
    }
  }

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const canEditOrDelete = (authorId: string) => user?.id === authorId || isAdmin;

  if (!q.data) return null;

  const ReelCard = ({ r, idx }: { r: Reel; idx: number }) => {
    const isLiked = likedReels.has(r.id);
    const isFavorite = favoriteReels.has(r.id);
    const canManage = canEditOrDelete(r.author_id);
    const isOfficialReel = r.author_id === "admin";

    return (
      <div key={r.id} className="group">
        <div
          onClick={() => openViewer(idx)}
          className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer ${
            isOfficialReel ? "ring-2 ring-brand-500" : ""
          }`}
        >
          <video
            src={r.video_url}
            poster={r.thumbnail_url || undefined}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 bg-ink"
          />

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-white/90 rounded-full p-3">
                <svg className="h-6 w-6 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </div>

          {isOfficialReel && (
            <div className="absolute top-2 left-2 flex items-center gap-1 badge bg-brand-500 text-white border-transparent text-xs">
              <Award className="h-3 w-3" />
              Official
            </div>
          )}

          {r.sport && !isOfficialReel && (
            <span className="absolute top-2 left-2 badge bg-ink/70 text-paper border-transparent text-xs">{r.sport}</span>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-3 text-white text-xs">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {r.like_count}</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {r.comment_count}</span>
              <span className="flex items-center gap-1 ml-auto"><Eye className="h-3 w-3" /> {r.view_count}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 space-y-1.5 text-sm">
          <div className="font-semibold text-[13px] text-ink truncate">
            {r.author_name}
            {isOfficialReel && <span className="ml-1 text-brand-500">✓</span>}
          </div>
          {r.caption && <p className="text-ink-70 text-[12px] line-clamp-2">{r.caption}</p>}

          <div className="flex items-center gap-2 pt-1.5 border-t border-hairsoft">
            <button
              onClick={() => like.mutate(r.id)}
              className={`flex items-center gap-1 text-[11px] font-mononum transition ${
                isLiked ? "text-brand-500" : "text-ink-sub hover:text-brand-500"
              }`}
            >
              <Heart className="h-3.5 w-3.5" fill={isLiked ? "currentColor" : "none"} />
              {r.like_count}
            </button>
            <span className="flex items-center gap-1 text-[11px] font-mononum text-ink-sub">
              <MessageCircle className="h-3.5 w-3.5" />
              {r.comment_count}
            </span>
            <button
              onClick={() => toggleFavoriteReel(r.id)}
              className={`flex items-center gap-1 text-[11px] font-mononum transition ml-auto ${
                isFavorite ? "text-yellow-500" : "text-ink-sub hover:text-yellow-500"
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" fill={isFavorite ? "currentColor" : "none"} />
            </button>

            {canManage && (
              <div className="relative">
                <button
                  data-menu-button
                  onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                  className="p-1 hover:bg-fill rounded transition"
                >
                  <MoreVertical className="h-3.5 w-3.5 text-ink-sub" />
                </button>
                {menuOpenId === r.id && (
                  <div data-menu-content className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                    <button
                      onClick={() => { setEditingId(r.id); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-ink hover:bg-fill border-b border-hairsoft"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit caption
                    </button>
                    <button
                      onClick={() => { setPendingDeleteId(r.id); setMenuOpenId(null); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {isAdmin && user?.id !== r.author_id ? "Remove" : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {editingId === r.id && (
            <div className="flex gap-2 pt-2">
              <input id={`edit-${r.id}`} defaultValue={r.caption || ""} className="input flex-1 text-xs" />
              <button
                onClick={() => {
                  const el = document.getElementById(`edit-${r.id}`) as HTMLInputElement;
                  update.mutate({ id: r.id, caption: el.value });
                }}
                disabled={update.isPending}
                className="btn-primary text-xs px-2 py-1"
              >
                Save
              </button>
              <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-2 py-1">✕</button>
            </div>
          )}

          {pendingDeleteId === r.id && (
            <div className="flex items-center gap-2 rounded bg-red-50 border border-red-200 p-2 mt-2">
              <span className="text-[11px] text-red-900 flex-1">Delete?</span>
              <button onClick={() => deleteReel.mutate(r.id)} disabled={deleteReel.isPending} className="btn-danger text-xs px-2 py-1">Yes</button>
              <button onClick={() => setPendingDeleteId(null)} className="btn-secondary text-xs px-2 py-1">No</button>
            </div>
          )}

          {flaggedReelId === r.id && (
            <div className="flex items-center gap-2 rounded bg-yellow-50 border border-yellow-200 p-2 mt-2">
              <span className="text-[11px] text-yellow-900 flex-1">Report?</span>
              <button onClick={() => flagReel.mutate(r.id)} disabled={flagReel.isPending} className="btn-secondary text-xs px-2 py-1">Yes</button>
              <button onClick={() => setFlaggedReelId(null)} className="btn-secondary text-xs px-2 py-1">No</button>
            </div>
          )}

          <div className="pt-2 mt-2 border-t border-hairsoft">
            <CommentSection parentType="reel" parentId={r.id} commentCount={r.comment_count} />
          </div>
        </div>
      </div>
    );
  };

  const officialReels = q.data.filter(r => r.author_id === "admin");
  const userReels = q.data.filter(r => r.author_id !== "admin");

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Reels"
        subtitle="Highlights · drills · technique"
        action={canUpload && (
          <button className="btn-accent" onClick={() => setOpen(true)}>
            + {isAdmin ? "Post Official Reel" : "Post a reel"}
          </button>
        )}
      />

      {open && (
        <div className="panel p-5 space-y-4 animate-fadein max-w-2xl">
          <div className="kicker">{isAdmin ? "New Official Reel" : "New reel"}</div>
          {isAdmin && (
            <div className="p-3 rounded bg-brand-50 border border-brand-200">
              <p className="text-xs text-brand-900">
                This reel will be marked as <strong>Official</strong> and appear in the Featured section.
              </p>
            </div>
          )}
          {/* Video Upload Zone */}
          <div className="space-y-2">
            <span className="label">Video *</span>
            {form.video_url ? (
              <div className="border border-green-300 rounded bg-green-50 p-4 space-y-2">
                <video src={form.video_url} poster={form.thumbnail_url} className="h-32 w-full object-cover rounded bg-ink" muted />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-green-900">✓ Video uploaded</div>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, video_url: "" }))}
                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : uploading === "video" ? (
              <div className="border-2 border-dashed border-brand-300 rounded p-6 bg-brand-50 space-y-3">
                <Upload className="h-8 w-8 text-brand-500 mx-auto" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium text-brand-900">Uploading…</p>
                  <div className="w-full bg-brand-200 rounded h-2 overflow-hidden">
                    <div className="bg-brand-500 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-xs text-brand-700">{uploadProgress}% · {(uploadFileSize / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-brand-300 rounded p-6 text-center bg-brand-50 space-y-3">
                  <Upload className="h-8 w-8 text-brand-500 mx-auto" />
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="btn-primary"
                  >
                    Pick a video file
                  </button>
                  <p className="text-xs text-brand-700">MP4, WebM, MOV · max 10 MB</p>
                </div>
                <div className="relative">
                  <input type="text" placeholder="Or paste a video URL" className="input" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
                </div>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadVideo(f); }}
            />
          </div>

          {/* Thumbnail Upload Zone */}
          <div className="space-y-2">
            <span className="label">Thumbnail (optional)</span>
            {form.thumbnail_url ? (
              <div className="border border-green-300 rounded bg-green-50 p-3 flex items-center justify-between">
                <img src={form.thumbnail_url} alt="Thumbnail" className="h-16 w-16 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, thumbnail_url: "" }))}
                  className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 transition"
                >
                  Remove
                </button>
              </div>
            ) : uploading === "thumbnail" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">Uploading…</p>
                <div className="w-full bg-fill rounded h-2 overflow-hidden">
                  <div className="bg-brand-500 h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <p className="text-xs text-ink-faint">{uploadProgress}% · {(uploadFileSize / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                className="btn-secondary w-full"
              >
                Upload thumbnail
              </button>
            )}
            <input
              ref={thumbInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadThumbnail(f); }}
            />
          </div>

          {/* Other Fields */}
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Sport</span>
              <input className="input" placeholder="e.g. Cricket" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Caption</span>
              <input className="input" placeholder="Describe the clip" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </label>
          </div>
          {err && <div className="text-sm text-red-700 rounded bg-red-50 p-3">{err}</div>}
          <div className="flex gap-2 justify-end pt-1">
            <button className="btn-secondary" onClick={() => setOpen(false)} disabled={uploading !== null}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || !form.video_url || uploading !== null} onClick={() => create.mutate()}>
              {create.isPending ? "Posting…" : uploading ? "Uploading…" : "Post reel →"}
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : !q.data?.length ? (
        <EmptyState title="No reels yet" hint="Post match highlights, training clips or technique breakdowns." />
      ) : (
        <>
          {officialReels.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-brand-500" />
                <h2 className="font-disp text-lg text-ink">Featured</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-max">
                {officialReels.map((r, idx) => (
                  <ReelCard key={r.id} r={r} idx={idx} />
                ))}
              </div>
            </section>
          )}

          {userReels.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-disp text-lg text-ink">User Reels</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-max">
                {userReels.map((r, idx) => (
                  <ReelCard key={r.id} r={r} idx={idx + officialReels.length} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {viewerOpen && q.data && (
        <ReelViewer
          reels={q.data}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          onLike={(id) => like.mutate(id)}
          onAddToFavorites={(id) => toggleFavoriteReel(id)}
          onFlag={(id) => setFlaggedReelId(id)}
          onCommentClick={(id) => setOpenCommentId(openCommentId === id ? null : id)}
          likedReels={likedReels}
          favoriteReels={favoriteReels}
        />
      )}
    </div>
  );
}
