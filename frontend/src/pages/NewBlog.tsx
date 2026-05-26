import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";

export default function NewBlog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const blogQ = useQuery({
    queryKey: ["blog", id],
    queryFn: async () => (await api.get(`/blogs/${id}`)).data.blog,
    enabled: !!id
  });

  const [form, setForm] = useState({
    title: "",
    body_markdown: "",
    excerpt: "",
    cover_image_url: "",
    tags: "",
    sport: "",
    status: "draft" as "draft" | "published"
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (blogQ.data) {
      const blog = blogQ.data;
      setForm({
        title: blog.title || "",
        body_markdown: blog.body_markdown || "",
        excerpt: blog.excerpt || "",
        cover_image_url: blog.cover_image_url || "",
        tags: (blog.tags || []).join(", "),
        sport: blog.sport || "",
        status: blog.status || "draft"
      });
    }
  }, [blogQ.data]);

  async function submit(status: "draft" | "published") {
    setBusy(true);
    setErr(null);
    try {
      const payload: any = { ...form, status, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] == null) && delete payload[k]);

      const r = isEdit
        ? await api.put(`/blogs/${id}`, payload)
        : await api.post("/blogs", payload);

      // Invalidate blog queries to get fresh data
      await qc.invalidateQueries({ queryKey: ["blog"] });
      await qc.invalidateQueries({ queryKey: ["blogs"] });

      navigate(`/blogs/${r.data.blog.slug ?? r.data.blog.id}`);
    } catch (e) {
      setErr(getApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && blogQ.isPending) return <Spinner />;

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title={isEdit ? "Edit blog" : "Write a blog"} subtitle="Markdown supported." />
      <div className="card card-body space-y-3">
        <label><span className="label">Title</span>
          <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label><span className="label">Cover image URL</span>
          <input className="input" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Sport</span>
            <input className="input" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} />
          </label>
          <label><span className="label">Tags (comma sep)</span>
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </label>
        </div>
        <label><span className="label">Excerpt</span>
          <textarea className="input" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
        </label>
        <label><span className="label">Body (markdown)</span>
          <textarea className="input font-mono text-sm" rows={16} value={form.body_markdown} onChange={(e) => setForm({ ...form, body_markdown: e.target.value })} />
        </label>
        {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy} onClick={() => submit("published")}>
            {busy ? (isEdit ? "Saving..." : "Publishing...") : isEdit ? "Save & publish" : "Publish"}
          </button>
          <button className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>
            {busy ? "Saving..." : "Save as draft"}
          </button>
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={() => navigate(isEdit ? `/blogs/${id}` : "/blogs")}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
