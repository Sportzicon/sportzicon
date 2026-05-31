import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { PageHeader, Spinner, EmptyState } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { useAuthStore } from "../store/auth";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, Eye } from "lucide-react";
import type { Reel } from "../types";

export default function Reels() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ video_url: "", thumbnail_url: "", caption: "", sport: "" });
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());

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
    queryFn: async () => (await api.get<{ items: Reel[] }>("/reels", { params: { limit: 30 } })).data.items
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      Object.keys(payload).forEach((k) => payload[k] === "" && delete payload[k]);
      return api.post("/reels", payload);
    },
    onSuccess: () => { setOpen(false); setForm({ video_url: "", thumbnail_url: "", caption: "", sport: "" }); qc.invalidateQueries({ queryKey: ["reels"] }); },
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reels"
        subtitle="Highlights · drills · technique"
        action={<button className="btn-accent" onClick={() => setOpen(true)}>+ Post a reel</button>}
      />

      {open && (
        <div className="panel p-5 space-y-4 animate-fadein">
          <div className="kicker">New reel</div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Video URL *</span>
              <input className="input" placeholder="mp4 / webm / mov" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Thumbnail URL</span>
              <input className="input" placeholder="Optional" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
            </label>
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
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={create.isPending || !form.video_url} onClick={() => create.mutate()}>
              {create.isPending ? "Posting…" : "Post reel →"}
            </button>
          </div>
        </div>
      )}

      {q.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : !q.data?.length ? (
        <EmptyState title="No reels yet" hint="Post match highlights, training clips or technique breakdowns." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 max-w-2xl lg:max-w-4xl">
          {q.data.map((r) => (
            <div key={r.id} className="panel overflow-hidden">
              <div className="aspect-[9/16] bg-ink relative">
                <video src={r.video_url} poster={r.thumbnail_url || undefined} controls className="h-full w-full" />
                {r.sport && (
                  <span className="absolute top-2 left-2 badge bg-ink/70 text-paper border-transparent">{r.sport}</span>
                )}
                {user?.id === r.author_id && (
                  <div className="absolute top-2 right-2">
                    <button
                      data-menu-button
                      onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                      className="bg-black/50 hover:bg-black/70 text-white p-2 rounded transition"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === r.id && (
                      <div data-menu-content className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                        <button
                          onClick={() => { setEditingId(r.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit caption
                        </button>
                        <button
                          onClick={() => { setPendingDeleteId(r.id); setMenuOpenId(null); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3">
                <div className="font-semibold text-[13.5px] text-ink">{r.author_name}</div>

                {editingId === r.id ? (
                  <div className="flex gap-2">
                    <input id={`edit-${r.id}`} defaultValue={r.caption || ""} className="input flex-1 text-sm" />
                    <button
                      onClick={() => {
                        const el = document.getElementById(`edit-${r.id}`) as HTMLInputElement;
                        update.mutate({ id: r.id, caption: el.value });
                      }}
                      disabled={update.isPending}
                      className="btn-primary"
                    >Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary">✕</button>
                  </div>
                ) : r.caption ? (
                  <p className="text-sm text-ink-70 leading-snug">{r.caption}</p>
                ) : null}

                {pendingDeleteId === r.id && (
                  <div className="flex items-center gap-2 rounded bg-red-50 border border-red-200 p-3">
                    <span className="text-[12.5px] text-red-900 flex-1">Delete this reel?</span>
                    <button onClick={() => deleteReel.mutate(r.id)} disabled={deleteReel.isPending} className="btn-danger">Confirm</button>
                    <button onClick={() => setPendingDeleteId(null)} className="btn-secondary">Cancel</button>
                  </div>
                )}

                <div className="flex items-center gap-4 pt-2 border-t border-hairsoft">
                  <button
                    onClick={() => like.mutate(r.id)}
                    className={`font-mononum text-[11px] flex items-center gap-1 transition ${likedReels.has(r.id) ? "text-brand-500" : "text-ink-sub hover:text-brand-500"}`}
                  >
                    <Heart className="h-3.5 w-3.5" fill={likedReels.has(r.id) ? "currentColor" : "none"} /> {r.like_count}
                  </button>
                  <button
                    onClick={() => setOpenCommentId(openCommentId === r.id ? null : r.id)}
                    className="font-mononum text-[11px] text-ink-sub hover:text-brand-500 flex items-center gap-1"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> {r.comment_count}
                  </button>
                  <span className="font-mononum text-[11px] text-ink-faint flex items-center gap-1 ml-auto">
                    <Eye className="h-3.5 w-3.5" /> {r.view_count}
                  </span>
                </div>

                {openCommentId === r.id && (
                  <CommentSection parentType="reel" parentId={r.id} commentCount={r.comment_count} showForm />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
