import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";
import type { Blog } from "../types";

export default function Blogs() {
  const q = useQuery({
    queryKey: ["blogs"],
    queryFn: async () => (await api.get<{ items: Blog[] }>("/blogs", { params: { limit: 30 } })).data.items
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Blogs" subtitle="Long-form posts from the community."
        action={<Link to="/blogs/new" className="btn-primary">Write a blog</Link>}
      />
      {q.isLoading ? <Spinner /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data?.map((b) => (
            <Link key={b.id} to={`/blogs/${b.slug ?? b.id}`} className="card hover:shadow">
              {b.cover_image_url && <img src={b.cover_image_url} alt="" className="h-40 w-full object-cover" />}
              <div className="card-body">
                <h3 className="font-semibold">{b.title}</h3>
                <p className="mt-1 text-sm text-slate-600 line-clamp-3">{b.excerpt}</p>
                <p className="mt-2 text-xs text-slate-500">By {b.author_name} · {new Date(b.published_at ?? b.created_at).toLocaleDateString()}</p>
              </div>
            </Link>
          ))}
          {!q.data?.length && <div className="card card-body text-sm text-slate-600 sm:col-span-2">No published blogs yet.</div>}
        </div>
      )}
    </div>
  );
}
