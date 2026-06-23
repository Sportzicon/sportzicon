import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, humanizeError } from "../api/client";
import { queryKeys } from "../hooks";
import { PageHeader, Spinner, SectionHead } from "../components/UI";
import { X } from "lucide-react";

const MAX_CONTENT = 50000;
const CONTENT_WARN = 45000;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 30;

const SPORTS = [
  "", "Cricket", "Football", "Basketball", "Swimming", "Athletics",
  "Hockey", "Tennis", "Badminton", "Volleyball", "Kabaddi", "Wrestling", "Boxing", "Other",
];

function Field({ label, children, hint, error }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
      {error && <span className="text-red-600 text-[11px] mt-1 block">{error}</span>}
    </label>
  );
}

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={3}
      style={{ resize: "none", overflow: "hidden" }}
    />
  );
}

function TagInput({
  tags,
  onChange,
  error,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const val = raw.trim().toLowerCase().replace(/\s+/g, "-").slice(0, MAX_TAG_LEN);
    if (!val || tags.includes(val) || tags.length >= MAX_TAGS) return;
    onChange([...tags, val]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div
        className={`input flex flex-wrap gap-1.5 min-h-[44px] cursor-text ${error ? "border-red-500" : ""}`}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 bg-ink text-paper text-[11px] rounded px-2 py-0.5"
          >
            #{tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-red-300 transition"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => { if (input.trim()) addTag(input); }}
            placeholder={tags.length === 0 ? "Type a tag and press Enter…" : "Add another…"}
            className="flex-1 min-w-[120px] bg-transparent outline-none text-[13px] text-ink placeholder:text-ink-faint"
          />
        )}
      </div>
      <p className="lab mt-1 normal-case tracking-normal text-[10.5px]">
        {tags.length}/{MAX_TAGS} tags · Press Enter or comma to add
      </p>
      {error && <span className="text-red-600 text-[11px] mt-1 block">{error}</span>}
    </div>
  );
}

export default function NewBlog() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const blogQ = useQuery({
    queryKey: queryKeys.blog(id ?? ""),
    queryFn: async () => (await api.get(`/blogs/${id}`)).data.blog,
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [excerpt, setExcerpt] = useState("");
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
      setExcerpt(b.excerpt || "");
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
      if (excerpt.trim()) payload.excerpt = excerpt.trim();
      if (coverUrl.trim()) payload.cover_image_url = coverUrl.trim();
      if (sport) payload.sport = sport;

      const r = isEdit
        ? await api.put(`/blogs/${id}`, payload)
        : await api.post("/blogs", payload);

      await qc.invalidateQueries({ queryKey: queryKeys.blogs() });
      if (id) await qc.invalidateQueries({ queryKey: queryKeys.blog(id) });
      navigate(`/blogs/${r.data.blog.id}`);
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

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sport">
            <select
              className="input w-full min-h-[44px]"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              <option value="">No sport</option>
              {SPORTS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Excerpt" hint="Auto-generated if left blank">
            <AutoGrowTextarea
              className="input w-full"
              value={excerpt}
              onChange={setExcerpt}
              placeholder="A compelling summary…"
            />
          </Field>
        </div>

        <div>
          <span className="label block mb-1">Tags</span>
          <TagInput tags={tags} onChange={setTags} error={errors.tags} />
        </div>
      </div>

      {/* Body section */}
      <div className="panel p-5 md:p-6 space-y-4">
        <SectionHead n="02" title="Body" sub="Markdown supported" />

        <div className="relative">
          <AutoGrowTextarea
            className={`input w-full font-mono text-sm leading-relaxed min-h-[240px] ${errors.body ? "border-red-500" : ""}`}
            value={body}
            onChange={setBody}
            placeholder={"# Your heading\n\nStart writing here. Markdown is supported — **bold**, _italic_, ## headings, - lists, and more."}
            maxLength={MAX_CONTENT}
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
        <p className="lab normal-case tracking-normal text-[11px]">
          Tip: Use ## for section headings, **bold** for emphasis, &gt; for quotes.
        </p>
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
