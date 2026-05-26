import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { api } from "../api/client";
import { Spinner } from "../components/UI";
import type { Blog } from "../types";

export default function BlogDetail() {
  const { idOrSlug = "" } = useParams();
  const q = useQuery({
    queryKey: ["blog", idOrSlug],
    queryFn: async () => (await api.get<{ blog: Blog }>(`/blogs/${idOrSlug}`)).data.blog
  });

  if (q.isLoading) return <Spinner />;
  const b = q.data;
  if (!b) return <div className="card card-body">Blog not found.</div>;

  return (
    <article className="max-w-3xl space-y-4">
      {b.cover_image_url && <img src={b.cover_image_url} alt="" className="w-full rounded-xl object-cover max-h-72" />}
      <h1 className="text-3xl font-bold tracking-tight">{b.title}</h1>
      <p className="text-sm text-slate-600">By {b.author_name} · {new Date(b.published_at ?? b.created_at).toLocaleDateString()}</p>
      <div className="prose max-w-none prose-slate prose-headings:tracking-tight">
        <ReactMarkdown>{b.body_markdown}</ReactMarkdown>
      </div>
    </article>
  );
}
