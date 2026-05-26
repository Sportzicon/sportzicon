import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner } from "../components/UI";
import { Heart, MessageCircle } from "lucide-react";
import type { Post } from "../types";

export default function Feed() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [type, setType] = useState<"post" | "log">("post");

  const feed = useQuery({
    queryKey: ["feed-all"],
    queryFn: async () => (await api.get<{ items: Post[] }>("/posts/feed", { params: { limit: 30 } })).data.items
  });
  const create = useMutation({
    mutationFn: async () => api.post("/posts", { type, text }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["feed-all"] });
    }
  });
  const like = useMutation({
    mutationFn: async (id: string) => api.post(`/posts/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed-all"] })
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader title="Feed" subtitle="Training logs, updates and quick posts." />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) create.mutate();
        }}
        className="card card-body space-y-2"
      >
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setType("post")} className={`btn ${type === "post" ? "btn-primary" : "btn-secondary"}`}>Update</button>
          <button type="button" onClick={() => setType("log")} className={`btn ${type === "log" ? "btn-primary" : "btn-secondary"}`}>Training log</button>
        </div>
        <textarea
          className="input"
          rows={3}
          placeholder={type === "log" ? "What did you train today?" : "Share an update..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="btn-primary" disabled={create.isPending}>Post</button>
        </div>
      </form>

      {feed.isLoading ? <Spinner /> : (
        <ul className="space-y-3">
          {feed.data?.map((p) => (
            <li key={p.id} className="card card-body">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{p.author_name}</div>
                <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{p.text}</p>
              <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                <button className="inline-flex items-center gap-1 hover:text-brand-700" onClick={() => like.mutate(p.id)}>
                  <Heart className="h-4 w-4" /> {p.like_count}
                </button>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" /> {p.comment_count}</span>
              </div>
            </li>
          ))}
          {!feed.data?.length && <li className="card card-body text-sm text-slate-600">Your feed is empty. Follow people to populate it.</li>}
        </ul>
      )}
    </div>
  );
}
