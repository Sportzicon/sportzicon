import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner, EmptyState, Kicker, SectionHead, StatusPill } from "../components/UI";
import type { Blog } from "../types";

export default function Blogs() {
  const [sport, setSport] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");

  const params: any = {};
  if (status) params.status = status;
  if (sport) params.sport = sport;
  if (tag) params.tag = tag;

  const q = useQuery({
    queryKey: ["blogs", params],
    queryFn: async () => (await api.get<{ items: Blog[] }>("/blogs", { params })).data.items
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Blogs"
        subtitle="Guides & insights"
        action={<Link to="/blogs/new" className="btn-accent">+ Write blog</Link>}
      />

      <div className="panel p-4 flex flex-wrap gap-3">
        <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <select className="input w-44" value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="">All sports</option>
          {["Cricket","Football","Athletics","Basketball","Hockey","Tennis","Badminton","Kabaddi"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input className="input w-44" placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>

      {q.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : !q.data?.length ? (
        <EmptyState
          title="No blogs found"
          hint="Try adjusting your filters or check back later."
          action={<Link to="/blogs/new" className="btn-accent">+ Write blog</Link>}
        />
      ) : (
        <>
          <SectionHead n="01" title="Latest blogs" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {q.data.map((b) => (
            <Link key={b.id} to={`/blogs/${b.id}`} className="panel overflow-hidden hover:shadow-card transition group">
              {b.cover_image_url && (
                <img src={b.cover_image_url} alt="" className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusPill status={b.status} />
                  {b.sport && <Kicker>{b.sport}</Kicker>}
                  {b.tags?.slice(0, 1).map((t) => <span key={t} className="badge text-[10px]">{t}</span>)}
                </div>
                <h3 className="font-disp text-lg leading-tight group-hover:text-brand-500 transition">{b.title}</h3>
                <p className="text-[13px] text-ink-sub mt-2 line-clamp-2">{b.excerpt || b.body_markdown?.slice(0, 80)}</p>
                <div className="mt-3 pt-3 border-t border-hairsoft flex items-center justify-between text-[11px]">
                  <span className="lab">{b.author_name}</span>
                  <span className="font-mononum text-ink-faint">◎ {b.view_count}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}
    </div>
  );
}
