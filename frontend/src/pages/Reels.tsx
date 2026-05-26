import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";
import { Heart } from "lucide-react";
import type { Reel } from "../types";

export default function Reels() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ video_url: "", thumbnail_url: "", caption: "", sport: "" });
  const [err, setErr] = useState<string | null>(null);

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
              <div className="aspect-[9/16] bg-black">
                <video src={r.video_url} poster={r.thumbnail_url} controls className="h-full w-full" />
              </div>
              <div className="p-3 text-sm">
                <div className="font-medium">{r.author_name}</div>
                {r.caption && <p className="text-slate-600 mt-1">{r.caption}</p>}
                <div className="mt-2 flex items-center gap-3 text-slate-600 text-xs">
                  <button onClick={() => like.mutate(r.id)} className="inline-flex items-center gap-1 hover:text-brand-700">
                    <Heart className="h-4 w-4" /> {r.like_count}
                  </button>
                  <span>{r.view_count} views</span>
                </div>
              </div>
            </div>
          ))}
          {!q.data?.length && <div className="card card-body text-sm text-slate-600 sm:col-span-2 lg:col-span-3">No reels yet.</div>}
        </div>
      )}
    </div>
  );
}
