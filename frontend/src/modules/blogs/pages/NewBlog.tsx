import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { humanizeError } from "../../../api/client";
import { blogService } from "../../../services";
import { queryKeys } from "../../../hooks";
import { PageHeader, Spinner, SectionHead } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { Field, TagInput, SPORTS } from "../components/BlogFormFields";
import { RichMarkdownEditor } from "../components/RichMarkdownEditor";

const MAX_CONTENT = 50000;
const CONTENT_WARN = 45000;

export default function NewBlog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const blogQ = useQuery({
    queryKey: queryKeys.blog(id ?? ""),
    queryFn: () => blogService.get(id!),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sport, setSport] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (blogQ.data) {
      const b = blogQ.data;
      setTitle(b.title || "");
      setBody(b.body_markdown || "");
      setCoverUrl(b.cover_image_url || "");
      setTags(Array.isArray(b.tags) ? b.tags : []);
      setSport(b.sport || "");
    }
  }, [blogQ.data]);

  const validate = useCallback((status: "draft" | "published") => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    else if (title.trim().length < 5) e.title = "Title must be at least 5 characters";
    if (status === "published" && body.length < 100) e.body = "Content must be at least 100 characters to publish";
    if (body.length > MAX_CONTENT) e.body = `Content too long (${body.length}/${MAX_CONTENT})`;
    if (coverUrl && !/^https?:\/\/.+/.test(coverUrl)) e.coverUrl = "Must be a valid URL";
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [title, body, coverUrl]);

  async function submit(status: "draft" | "published") {
    if (!validate(status)) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        body_markdown: body,
        status,
        tags,
      };
      if (coverUrl.trim()) payload.cover_image_url = coverUrl.trim();
      if (sport) payload.sport = sport;

      const saved = isEdit
        ? await blogService.update(id!, payload)
        : await blogService.create(payload);

      await qc.invalidateQueries({ queryKey: queryKeys.blogs() });
      if (id) await qc.invalidateQueries({ queryKey: queryKeys.blog(id) });
      navigate(`/blogs/${saved.id}`);
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && blogQ.isPending) {
    return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  }

  const contentLen = body.length;
  const contentOver = contentLen > CONTENT_WARN;

  return (
    // Extra bottom padding on mobile for sticky bar
    <div className="space-y-5 max-w-3xl pb-[80px] lg:pb-0">
      <BackButton />
      <PageHeader
        title={isEdit ? "Edit blog" : "Write a blog"}
        subtitle="Long reads"
        sticky
        action={
          // Desktop action buttons in header
          <div className="hidden lg:flex gap-2">
            <button
              type="button"
              className="btn-ghost min-h-[44px]"
              disabled={busy}
              onClick={() => navigate(isEdit ? `/blogs/${id}` : "/blogs")}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-secondary min-h-[44px]"
              disabled={busy}
              onClick={() => submit("draft")}
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className="btn-accent min-h-[44px]"
              disabled={busy}
              onClick={() => submit("published")}
            >
              {busy ? "Publishing…" : isEdit ? "Save & publish" : "Publish →"}
            </button>
          </div>
        }
      />

      {/* Meta section */}
      <div className="panel p-5 md:p-6 space-y-5">
        <SectionHead n="01" title="Meta" />

        <Field label="Title *" error={errors.title}>
          <input
            className={`input w-full text-lg font-semibold min-h-[44px] ${errors.title ? "border-red-500" : ""}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="An attention-grabbing headline"
            maxLength={200}
          />
          <span className="lab mt-1 normal-case tracking-normal text-[10.5px]">{title.length}/200</span>
        </Field>

        <Field label="Cover image URL" error={errors.coverUrl}>
          <input
            className={`input w-full min-h-[44px] ${errors.coverUrl ? "border-red-500" : ""}`}
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
        </Field>
        {coverUrl && !errors.coverUrl && (
          <img src={coverUrl} alt="" className="w-full aspect-video object-cover rounded border border-hair" />
        )}

        <Field label="Sport">
          <select
            className="input w-full min-h-[44px] sm:max-w-xs"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            <option value="">No sport</option>
            {SPORTS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        <div>
          <span className="label block mb-1">Tags</span>
          <TagInput tags={tags} onChange={setTags} error={errors.tags} />
        </div>
      </div>

      {/* Body section */}
      <div className="panel p-5 md:p-6 space-y-4">
        <SectionHead n="02" title="Body" sub="Markdown supported" />

        <div className="relative">
          <RichMarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="Start writing here…"
            minHeightClass="min-h-[280px]"
            error={!!errors.body}
          />
          <span
            className={`absolute bottom-2 right-3 font-mononum text-[10px] pointer-events-none ${
              contentOver ? "text-red-500" : "text-ink-faint"
            }`}
          >
            {contentLen.toLocaleString()}/{MAX_CONTENT.toLocaleString()}
          </span>
        </div>
        {errors.body && <p className="text-red-600 text-[11px]">{errors.body}</p>}
      </div>

      {err && (
        <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>
      )}

      {/* Desktop bottom submit (redundant with header but keeps the scroll-to-bottom UX) */}
      <div className="hidden lg:flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary min-h-[44px]"
          disabled={busy}
          onClick={() => submit("draft")}
        >
          Save draft
        </button>
        <button
          type="button"
          className="btn-accent min-h-[44px]"
          disabled={busy}
          onClick={() => submit("published")}
        >
          {busy ? "Publishing…" : isEdit ? "Save & publish" : "Publish →"}
        </button>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="lg:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-0 right-0 z-40 bg-panel border-t border-hair flex gap-2 p-3">
        <button
          type="button"
          className="btn-ghost flex-1 min-h-[44px]"
          disabled={busy}
          onClick={() => navigate(isEdit ? `/blogs/${id}` : "/blogs")}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-secondary flex-1 min-h-[44px]"
          disabled={busy}
          onClick={() => submit("draft")}
        >
          Draft
        </button>
        <button
          type="button"
          className="btn-accent flex-1 min-h-[44px]"
          disabled={busy}
          onClick={() => submit("published")}
        >
          {busy ? "…" : isEdit ? "Save" : "Publish"}
        </button>
      </div>
    </div>
  );
}
