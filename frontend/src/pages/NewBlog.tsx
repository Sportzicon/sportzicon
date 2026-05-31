import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { PageHeader, Spinner, SectionHead } from "../components/UI";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
    </label>
  );
}

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
    title: "", body_markdown: "", excerpt: "", cover_image_url: "",
    tags: "", sport: "", status: "draft" as "draft" | "published"
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (blogQ.data) {
      const b = blogQ.data;
      setForm({
        title: b.title || "", body_markdown: b.body_markdown || "", excerpt: b.excerpt || "",
        cover_image_url: b.cover_image_url || "", tags: (b.tags || []).join(", "),
        sport: b.sport || "", status: b.status || "draft"
      });
    }
  }, [blogQ.data]);

  async function submit(status: "draft" | "published") {
    setBusy(true); setErr(null);
    try {
      const payload: any = {
        ...form, status,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean)
      };
      Object.keys(payload).forEach((k) => (payload[k] === "" || payload[k] == null) && delete payload[k]);
      const r = isEdit
        ? await api.put(`/blogs/${id}`, payload)
        : await api.post("/blogs", payload);
      await qc.invalidateQueries({ queryKey: ["blog"] });
      await qc.invalidateQueries({ queryKey: ["blogs"] });
      navigate(`/blogs/${r.data.blog.slug ?? r.data.blog.id}`);
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setBusy(false); }
  }

  if (isEdit && blogQ.isPending) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title={isEdit ? "Edit blog" : "Write a blog"}
        subtitle="Long reads"
        action={
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" disabled={busy}
              onClick={() => navigate(isEdit ? `/blogs/${id}` : "/blogs")}>Cancel</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" className="btn-accent" disabled={busy} onClick={() => submit("published")}>
              {busy ? "Publishing…" : isEdit ? "Save & publish" : "Publish →"}
            </button>
          </div>
        }
      />

      <div className="panel p-6 space-y-5">
        <SectionHead n="01" title="Meta" />
        <Field label="Title *">
          <input className="input text-lg font-semibold" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="An attention-grabbing headline" />
        </Field>
        <Field label="Cover image URL">
          <input className="input" value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} placeholder="https://…" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sport" hint="Used for filtering and discovery.">
            <input className="input" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })} placeholder="e.g. Cricket" />
          </Field>
          <Field label="Tags" hint="Comma-separated: scouting, trials, fitness">
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="tag1, tag2, tag3" />
          </Field>
        </div>
        <Field label="Excerpt" hint="Shown on the blog listing page. Auto-generated if left blank.">
          <textarea className="input" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="A compelling summary of what the reader will learn…" />
        </Field>
      </div>

      <div className="panel p-6 space-y-4">
        <SectionHead n="02" title="Body" sub="Markdown supported" />
        <textarea
          className="input font-mono text-sm leading-relaxed"
          rows={20}
          value={form.body_markdown}
          onChange={(e) => setForm({ ...form, body_markdown: e.target.value })}
          placeholder={`# Your heading\n\nStart writing here. Markdown is supported — **bold**, _italic_, ## headings, - lists, and more.`}
        />
        <p className="lab normal-case tracking-normal text-[11px]">Tip: Use ## for section headings, **bold** for emphasis, and &gt; for quotes.</p>
      </div>

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => submit("draft")}>Save draft</button>
        <button type="button" className="btn-accent" disabled={busy} onClick={() => submit("published")}>
          {busy ? "Publishing…" : isEdit ? "Save & publish" : "Publish →"}
        </button>
      </div>
    </div>
  );
}
