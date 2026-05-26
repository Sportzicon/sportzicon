import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { useAuthStore } from "../store/auth";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle } from "lucide-react";
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    onSuccess: () => {
      setOpen(false);
      setForm({ video_url: "", thumbnail_url: "", caption: "", sport: "" });
      qc.invalidateQueries({ queryKey: ["reels"] });
    },
    onError: (e) => setErr(getApiError(e).message)
  });

  const update = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) =>
      api.put(`/reels/${id}`, { caption }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels"] });
      setEditingId(null);
    }
  });

  const deleteReel = useMutation({
    mutationFn: async (id: string) => api.delete(`/reels/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels"] });
      setPendingDeleteId(null);
    }
  });

  const like = useMutation({
    mutationFn: async (id: string) => api.post(`/reels/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reels"] })
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Reels" subtitle="Short videos — highlights, drills, technique."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>Post a reel</button>}
      />
      {open && (
        <div className="card card-body space-y-3">
          <h3 className="font-semibold">New reel</h3>
          <input className="input" placeholder="Video URL (mp4/webm/mov)" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
          <input className="input" placeholder="Thumbnail URL (optional)" value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} />
          <input className="input" placeholder="Sport" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
          <textarea className="input" rows={2} placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
          {err && <div className="text-sm text-red-700">{err}</div>}
          <div className="flex gap-2">
            <button className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>Post</button>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
          <p className="text-xs text-slate-500">Tip: Upload your video first via the media API to get a stable URL.</p>
        </div>
      )}
      {q.isLoading ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data?.map((r) => (
            <div key={r.id} className="card overflow-hidden">
              <div className="aspect-[9/16] bg-black relative">
                <video src={r.video_url} poster={r.thumbnail_url} controls className="h-full w-full" />
                {user?.id === r.author_id && (
                  <div className="absolute top-2 right-2" ref={menuOpenId === r.id ? menuRef : undefined}>
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                      className="bg-slate-800 hover:bg-slate-900 text-white p-2 rounded transition"
                      title="More options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenId === r.id && (
                      <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-40">
                        <button
                          onClick={() => {
                            setEditingId(r.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 rounded-t-lg"
                        >
                          <Pencil className="h-4 w-4" /> Edit caption
                        </button>
                        <button
                          onClick={() => {
                            setPendingDeleteId(r.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="p-3 text-sm space-y-2">
                <div className="font-medium">{r.author_name}</div>

                {editingId === r.id ? (
                  <div className="flex gap-2">
                    <input
                      id={`edit-${r.id}`}
                      defaultValue={r.caption || ""}
                      className="input flex-1 text-sm"
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById(`edit-${r.id}`) as HTMLInputElement;
                        update.mutate({ id: r.id, caption: input.value });
                      }}
                      disabled={update.isPending}
                      className="btn-primary btn-sm"
                    >
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary btn-sm">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {r.caption && <p className="text-slate-600">{r.caption}</p>}
                    {pendingDeleteId === r.id && (
                      <div className="bg-red-50 p-2 rounded flex gap-2 items-center">
                        <span className="text-xs text-red-900">Delete reel?</span>
                        <button
                          onClick={() => deleteReel.mutate(r.id)}
                          disabled={deleteReel.isPending}
                          className="btn-danger btn-sm"
                        >
                          Confirm
                        </button>
                        <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm">
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-2 flex items-center gap-3 text-slate-600 text-xs">
                  <button onClick={() => like.mutate(r.id)} className="inline-flex items-center gap-1 hover:text-brand-700">
                    <Heart className="h-4 w-4" /> {r.like_count}
                  </button>
                  <button
                    onClick={() => setOpenCommentId(openCommentId === r.id ? null : r.id)}
                    className="inline-flex items-center gap-1 hover:text-brand-700"
                  >
                    <MessageCircle className="h-4 w-4" /> {r.comment_count}
                  </button>
                  <span>{r.view_count} views</span>
                </div>
                {openCommentId === r.id && (
                  <CommentSection parentType="reel" parentId={r.id} commentCount={r.comment_count} showForm={true} />
                )}
              </div>
            </div>
          ))}
          {!q.data?.length && <div className="card card-body text-sm text-slate-600 sm:col-span-2 lg:col-span-3">No reels yet.</div>}
        </div>
      )}
    </div>
  );
}
