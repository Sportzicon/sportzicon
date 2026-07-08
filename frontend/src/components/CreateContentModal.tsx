import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { X } from "lucide-react";
import { PostComposer } from "../modules/feed/components/PostComposer";
import { ImageUpload } from "../modules/reels/components/ImageUpload";
import { Field, TagInput, SPORTS } from "../modules/blogs/components/BlogFormFields";
import { RichMarkdownEditor } from "../modules/blogs/components/RichMarkdownEditor";
import { MobileDrawer } from "./MobileDrawer";
import { postService, blogService } from "../services";
import { queryKeys } from "../hooks/queryKeys";
import { humanizeError } from "../api/client";
import { useAuthStore } from "../store/auth";
import type { PostMedia } from "../models";

interface CreateContentModalProps {
  open: boolean;
  onClose: () => void;
}

type Mode = "post" | "article";

export function CreateContentModal({ open, onClose }: CreateContentModalProps) {
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("post");
  const [resetKey, setResetKey] = useState(0);
  const [postError, setPostError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [sport, setSport] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [articleError, setArticleError] = useState<string | null>(null);

  function closeAndReset() {
    setMode("post");
    setResetKey((k) => k + 1);
    setPostError(null);
    setTitle("");
    setBody("");
    setTags([]);
    setSport("");
    setCoverUrl("");
    setErrors({});
    setArticleError(null);
    onClose();
  }

  const postCreate = useMutation({
    mutationFn: (data: { content_json: JSONContent; media: PostMedia[] }) =>
      postService.create({ type: "post", content_json: data.content_json, media: data.media }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() });
      if (user) qc.invalidateQueries({ queryKey: queryKeys.authorContent(user.id) });
      closeAndReset();
    },
    onError: (e) => setPostError(humanizeError(e)),
  });

  const articleCreate = useMutation({
    mutationFn: (payload: Record<string, unknown>) => blogService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.blogs() });
      if (user) qc.invalidateQueries({ queryKey: queryKeys.authorContent(user.id) });
      closeAndReset();
    },
    onError: (e) => setArticleError(humanizeError(e)),
  });

  function validateArticle(status: "draft" | "published") {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    else if (title.trim().length < 5) e.title = "Title must be at least 5 characters";
    if (status === "published" && body.length < 100) e.body = "Content must be at least 100 characters to publish";
    if (body.length > 50000) e.body = `Content too long (${body.length}/50000)`;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submitArticle(status: "draft" | "published") {
    if (!validateArticle(status)) return;
    setArticleError(null);
    const payload: Record<string, unknown> = { title: title.trim(), body_markdown: body, status, tags };
    if (sport) payload.sport = sport;
    if (coverUrl) payload.cover_image_url = coverUrl;
    articleCreate.mutate(payload);
  }

  if (!user) return null;

  const modeToggle = (
    <div className="flex gap-2">
      {(["post", "article"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 min-h-[44px] rounded border transition ${
            mode === m ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
          }`}
        >
          {m === "post" ? "Post" : "Article"}
        </button>
      ))}
    </div>
  );

  const postBody = (
    <div className="space-y-3">
      <PostComposer
        key={resetKey}
        submitting={postCreate.isPending}
        submitLabel="Post →"
        onSubmit={(data) => postCreate.mutate(data)}
        onCancel={closeAndReset}
      />
      {postError && <p className="text-sm text-red-600">{postError}</p>}
    </div>
  );

  const articleBody = (
    <div className="space-y-4">
      <Field label="Title *" error={errors.title}>
        <input
          className={`input w-full min-h-[44px] ${errors.title ? "border-red-500" : ""}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="An attention-grabbing headline"
          maxLength={200}
        />
      </Field>

      <ImageUpload label="Cover image (optional)" context="blog-cover" aspectRatio="16/9" value={coverUrl} onChange={setCoverUrl} />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Sport">
          <select className="input w-full min-h-[44px]" value={sport} onChange={(e) => setSport(e.target.value)}>
            <option value="">No sport</option>
            {SPORTS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div>
          <span className="label block mb-1">Tags</span>
          <TagInput tags={tags} onChange={setTags} />
        </div>
      </div>

      <Field label="Content *" error={errors.body} hint={`${body.length}/50,000`}>
        <RichMarkdownEditor
          value={body}
          onChange={setBody}
          placeholder="Write your article…"
          minHeightClass="min-h-[160px]"
          error={!!errors.body}
        />
      </Field>

      {articleError && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{articleError}</div>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="btn-secondary flex-1 min-h-[44px]"
          disabled={articleCreate.isPending}
          onClick={() => submitArticle("draft")}
        >
          Save draft
        </button>
        <button
          type="button"
          className="btn-primary flex-1 min-h-[44px]"
          disabled={articleCreate.isPending}
          onClick={() => submitArticle("published")}
        >
          {articleCreate.isPending ? "Publishing…" : "Publish →"}
        </button>
      </div>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {modeToggle}
      {mode === "post" ? postBody : articleBody}
    </div>
  );

  return (
    <>
      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
        <MobileDrawer isOpen={open} onClose={closeAndReset} title="Create">
          {content}
        </MobileDrawer>
      </div>

      {/* Desktop centered modal */}
      {open && (
        <div
          className="hidden lg:flex fixed inset-0 z-50 items-center justify-center bg-black/60"
          onClick={closeAndReset}
        >
          <div
            className="bg-panel rounded-2xl shadow-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-disp text-xl text-ink">Create</h2>
              <button
                onClick={closeAndReset}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-sub hover:text-ink"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
