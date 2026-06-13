import { useState, useEffect } from "react";
import { useFeed } from "../hooks";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, EmptyState, Avatar, Tabs } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import type { Post } from "../models";

export default function Feed() {
  const user = useAuthStore((s) => s.user);
  const { feed, create, update, remove, toggleLike, likedPosts } = useFeed(30);
  const [text, setText] = useState("");
  const [type, setType] = useState<"post" | "log">("post");
  const [tab, setTab] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const posts = (feed.data ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const filtered = tab === "Updates" ? posts.filter((p) => p.type === "post")
    : tab === "Training logs" ? posts.filter((p) => p.type === "log")
    : posts;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Feed" subtitle="Your network" />

      <div className="panel p-4">
        <div className="flex gap-3">
          <Avatar name={user?.full_name ?? ""} src={user?.profile_photo_url} size={40} accent />
          <div className="flex-1">
            <div className="flex gap-2 mb-2">
              {(["post", "log"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-1.5 rounded border transition ${
                    type === t ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
                  }`}>
                  {t === "log" ? "Training log" : "Update"}
                </button>
              ))}
            </div>
            <textarea className="input" rows={2}
              placeholder={type === "log" ? "What did you train today?" : "Share an update with your network…"}
              value={text} onChange={(e) => setText(e.target.value)} style={{ resize: "none" }} />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button className="btn-accent" disabled={create.isPending || !text.trim()}
            onClick={() => text.trim() && create.mutate({ type, text }, { onSuccess: () => setText("") })}>
            {create.isPending ? "Posting…" : "Post →"}
          </button>
        </div>
      </div>

      <Tabs tabs={["All", "Updates", "Training logs"]} active={tab} onChange={setTab} />

      {feed.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" hint="Follow people or post your first training log." />
      ) : (
        <ul className="space-y-3">
          {filtered.map((p: Post) => (
            <li key={p.id} className="panel p-5">
              <div className="flex items-center gap-3">
                <Link to={`/profile/${p.author_id}`}>
                  <Avatar name={p.author_name} src={p.author?.profile_photo_url} size={38} />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/profile/${p.author_id}`} className="text-[13.5px] font-semibold text-ink hover:text-brand-500">
                      {p.author_name}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="lab">{new Date(p.created_at).toLocaleDateString()}</span>
                      {user?.id === p.author_id && (
                        <div className="relative">
                          <button data-menu-button onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}
                            className="p-1 rounded text-ink-faint hover:text-ink hover:bg-fill">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpenId === p.id && (
                            <div data-menu-content className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-32">
                              <button onClick={() => { setEditingId(p.id); setMenuOpenId(null); }}
                                className="w-full text-left px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill flex items-center gap-2 border-b border-hairsoft">
                                <Pencil className="h-3.5 w-3.5" /> Edit
                              </button>
                              <button onClick={() => { setPendingDeleteId(p.id); setMenuOpenId(null); }}
                                className="w-full text-left px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 flex items-center gap-2">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="lab mt-0.5">
                    {p.type === "log" ? "Training log" : "Update"}{p.sport ? ` · ${p.sport}` : ""}
                  </div>
                </div>
              </div>

              {editingId === p.id ? (
                <div className="mt-3 flex gap-2">
                  <textarea id={`edit-${p.id}`} defaultValue={p.text} className="input flex-1 text-sm" rows={3} />
                  <div className="flex flex-col gap-2">
                    <button onClick={() => {
                      const el = document.getElementById(`edit-${p.id}`) as HTMLTextAreaElement;
                      update.mutate({ id: p.id, text: el.value }, { onSuccess: () => setEditingId(null) });
                    }} disabled={update.isPending} className="btn-primary">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[14.5px] text-ink-70 leading-relaxed whitespace-pre-wrap">{p.text}</p>
              )}

              {pendingDeleteId === p.id && (
                <div className="mt-3 flex items-center gap-3 rounded bg-red-50 border border-red-200 p-3">
                  <span className="flex-1 text-sm text-red-900">Delete this post?</span>
                  <button onClick={() => remove.mutate(p.id, { onSuccess: () => setPendingDeleteId(null) })}
                    disabled={remove.isPending} className="btn-danger">Confirm</button>
                  <button onClick={() => setPendingDeleteId(null)} className="btn-secondary">Cancel</button>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-hairsoft flex items-center gap-5">
                <button onClick={() => toggleLike.mutate(p.id)}
                  className={`font-mononum text-[11.5px] flex items-center gap-1.5 transition ${likedPosts.has(p.id) ? "text-brand-500" : "text-ink-sub hover:text-brand-500"}`}>
                  <Heart className="h-4 w-4" fill={likedPosts.has(p.id) ? "currentColor" : "none"} /> {p.like_count}
                </button>
                <span className="font-mononum text-[11.5px] text-ink-sub flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4" /> {p.comment_count}
                </span>
              </div>

              <CommentSection parentType="post" parentId={p.id} commentCount={p.comment_count} showForm />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
