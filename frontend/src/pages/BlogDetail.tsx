import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { api } from "../api/client";
import { Spinner, StatusPill, Kicker } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { useAuthStore } from "../store/auth";
import { Trash2, Pencil, MoreVertical, Heart } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Blog } from "../types";

export default function BlogDetail() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const { idOrSlug = "" } = useParams();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["blog", idOrSlug],
    queryFn: async () => (await api.get<{ blog: Blog }>(`/blogs/${idOrSlug}`)).data.blog
  });

  const likeMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/blogs/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blog", idOrSlug] })
  });

  const deleteBlog = useMutation({
    mutationFn: async (id: string) => api.delete(`/blogs/${id}`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["blog"] }),
        qc.invalidateQueries({ queryKey: ["blogs"] }),
      ]);
      navigate("/blogs");
    }
  });

  if (q.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  if (q.isError) return <div className="panel p-8 text-center font-disp text-xl text-ink-70">Blog not found.</div>;
  const b = q.data!;

  const isAuthor = user?.id === b.author_id;

  return (
    <article className="max-w-3xl space-y-0">
      {/* cover */}
      {b.cover_image_url && (
        <img src={b.cover_image_url} alt="" className="w-full h-64 object-cover rounded-t border-x border-t border-hair" />
      )}

      {/* header */}
      <div className={`panel p-8 ${b.cover_image_url ? "rounded-t-none border-t-0" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {b.sport && <Kicker>{b.sport}</Kicker>}
              <StatusPill status={b.status} />
              {b.tags?.map((tag) => <span key={tag} className="badge">{tag}</span>)}
            </div>
            <h1 className="font-disp text-4xl lg:text-5xl leading-tight">{b.title}</h1>
            <div className="flex items-center gap-4 mt-4">
              <div className="lab">By {b.author_name}</div>
              <div className="lab">{new Date(b.published_at ?? b.created_at).toLocaleDateString()}</div>
              <div className="lab">◎ {b.view_count} views</div>
            </div>
          </div>
          {isAuthor && (
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)} className="btn-ghost p-2">
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-1 panel shadow-pop z-10 min-w-36">
                  <Link to={`/blogs/${b.id}/edit`} onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button onClick={() => { setPendingDelete(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {pendingDelete && (
          <div className="mt-4 flex items-center gap-4 rounded bg-red-50 border border-red-200 p-4">
            <div className="flex-1"><p className="font-semibold text-red-900">Delete this blog?</p><p className="text-sm text-red-700 mt-0.5">This cannot be undone.</p></div>
            <button onClick={() => deleteBlog.mutate(b.id)} disabled={deleteBlog.isPending} className="btn-danger">Confirm delete</button>
            <button onClick={() => setPendingDelete(false)} className="btn-secondary">Cancel</button>
          </div>
        )}
      </div>

      {/* body */}
      <div className="panel p-8 border-t-0 rounded-t-none">
        <div className="prose prose-slate max-w-none prose-headings:font-disp prose-headings:tracking-tight prose-a:text-brand-500">
          <ReactMarkdown>{b.body_markdown}</ReactMarkdown>
        </div>

        {/* like + stats */}
        <div className="mt-8 pt-6 border-t border-hairsoft flex items-center gap-6">
          <button
            onClick={() => likeMutation.mutate(b.id)}
            className="font-mononum text-[11px] uppercase tracking-[0.08em] text-ink-sub hover:text-brand-500 flex items-center gap-2 transition"
          >
            <Heart className="h-4 w-4" /> {b.like_count} likes
          </button>
          <span className="font-mononum text-[11px] text-ink-faint">❝ {b.comment_count} comments</span>
        </div>

        <div className="mt-6">
          <CommentSection parentType="blog" parentId={b.id} commentCount={b.comment_count} />
        </div>
      </div>
    </article>
  );
}
