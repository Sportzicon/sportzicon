import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle } from "lucide-react";
import type { Post } from "../types";

export default function Feed() {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [type, setType] = useState<"post" | "log">("post");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const update = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) =>
      api.put(`/posts/${id}`, { text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-all"] });
      setEditingId(null);
    }
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => api.delete(`/posts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed-all"] });
      setPendingDeleteId(null);
    }
  });

  const like = useMutation({
    mutationFn: async (id: string) => api.post(`/posts/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feed-all"] })
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
                <div className="flex items-center gap-2">
                  <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
                  {user?.id === p.author_id && (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                        className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded"
                        title="More options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpenId === p.id && (
                        <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => {
                              setEditingId(p.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100"
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => {
                              setPendingDeleteId(p.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {editingId === p.id ? (
                <div className="mt-2 flex gap-2">
                  <textarea
                    id={`edit-${p.id}`}
                    defaultValue={p.text}
                    className="input flex-1 text-sm"
                    rows={3}
                  />
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => {
                        const input = document.getElementById(`edit-${p.id}`) as HTMLTextAreaElement;
                        update.mutate({ id: p.id, text: input.value });
                      }}
                      disabled={update.isPending}
                      className="btn-primary btn-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{p.text}</p>
                  {pendingDeleteId === p.id && (
                    <div className="mt-2 flex gap-2 rounded-lg bg-red-50 p-3">
                      <div className="flex-1">
                        <p className="text-sm text-red-900">Delete this post?</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => deletePost.mutate(p.id)}
                          disabled={deletePost.isPending}
                          className="btn-danger btn-sm"
                        >
                          Confirm
                        </button>
                        <button onClick={() => setPendingDeleteId(null)} className="btn-secondary btn-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                <button className="inline-flex items-center gap-1 hover:text-brand-700" onClick={() => like.mutate(p.id)}>
                  <Heart className="h-4 w-4" /> {p.like_count}
                </button>
                <button
                  className="inline-flex items-center gap-1 hover:text-brand-700"
                  onClick={() => setOpenCommentId(openCommentId === p.id ? null : p.id)}
                >
                  <MessageCircle className="h-4 w-4" /> {p.comment_count}
                </button>
              </div>
              {openCommentId === p.id && (
                <CommentSection parentType="post" parentId={p.id} commentCount={p.comment_count} showForm={true} />
              )}
            </li>
          ))}
          {!feed.data?.length && <li className="card card-body text-sm text-slate-600">Your feed is empty. Follow people to populate it.</li>}
        </ul>
      )}
    </div>
  );
}
