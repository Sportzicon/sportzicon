import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { api } from "../api/client";
import { Spinner, StatusPill } from "../components/UI";
import { CommentSection } from "../components/CommentSection";
import { useAuthStore } from "../store/auth";
import { Trash2, Pencil, MoreVertical } from "lucide-react";
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
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const q = useQuery({
    queryKey: ["blog", idOrSlug],
    queryFn: async () => (await api.get<{ blog: Blog }>(`/blogs/${idOrSlug}`)).data.blog
  });

  const deleteBlog = useMutation({
    mutationFn: async (id: string) => api.delete(`/blogs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog"] });
      navigate("/blogs");
    }
  });

  if (q.isLoading) return <Spinner />;
  const b = q.data;
  if (!b) return <div className="card card-body">Blog not found.</div>;

  const isAuthor = user?.id === b.author_id;

  return (
    <article className="max-w-3xl space-y-4">
      {b.cover_image_url && <img src={b.cover_image_url} alt="" className="w-full rounded-xl object-cover max-h-72" />}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight">{b.title}</h1>
              <p className="text-sm text-slate-600 mt-2">By {b.author_name} · {new Date(b.published_at ?? b.created_at).toLocaleDateString()}</p>
            </div>
            <StatusPill status={b.status} />
          </div>
        </div>
        {isAuthor && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition"
              title="More options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                <Link
                  to={`/blogs/${b.id}/edit`}
                  onClick={() => setMenuOpen(false)}
                  className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-100 rounded-t-lg"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
                <button
                  onClick={() => {
                    setPendingDelete(true);
                    setMenuOpen(false);
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

      {pendingDelete && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-4 items-center">
          <div>
            <p className="font-medium text-red-900">Delete this blog?</p>
            <p className="text-sm text-red-700 mt-1">This action cannot be undone.</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => deleteBlog.mutate(b.id)}
              disabled={deleteBlog.isPending}
              className="btn-danger"
            >
              Confirm delete
            </button>
            <button onClick={() => setPendingDelete(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="prose max-w-none prose-slate prose-headings:tracking-tight">
        <ReactMarkdown>{b.body_markdown}</ReactMarkdown>
      </div>

      <CommentSection parentType="blog" parentId={b.id} commentCount={b.comment_count} />
    </article>
  );
}
