import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Video as VideoIcon, X } from "lucide-react";
import { uploadToGCS, MAX_SIZE_MB, ACCEPT_BY_CONTEXT } from "../../../hooks/useUpload";
import { humanizeError } from "../../../api/client";
import { Spinner } from "../../../components/UI";
import type { PostMedia } from "../../../models";

interface MediaSlot {
  localId: string;
  file: File;
  previewUrl: string;
  type: "image" | "video";
  uploadedUrl?: string;
  progress: number;
  uploading: boolean;
  error?: string;
}

interface PostComposerProps {
  showTypeToggle?: boolean;
  initialType?: "post" | "log";
  initialContentJson?: JSONContent;
  initialMedia?: PostMedia[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: (data: { type: "post" | "log"; content_json: JSONContent; media: PostMedia[] }) => void;
  onCancel?: () => void;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function PostComposer({
  showTypeToggle = true,
  initialType = "post",
  initialContentJson,
  initialMedia,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: PostComposerProps) {
  const [type, setType] = useState<"post" | "log">(initialType);
  const [slots, setSlots] = useState<MediaSlot[]>(
    (initialMedia ?? []).map((m) => ({
      localId: m.url,
      file: new File([], ""),
      previewUrl: m.url,
      type: m.type,
      uploadedUrl: m.url,
      progress: 100,
      uploading: false,
    }))
  );

  const editor = useEditor({
    extensions: [StarterKit, Link],
    content: initialContentJson ?? EMPTY_DOC,
  });

  function addFiles(files: FileList | null, kind: "image" | "video") {
    if (!files || files.length === 0) return;
    const room = 10 - slots.length;
    if (room <= 0) return;
    const newSlots: MediaSlot[] = Array.from(files)
      .slice(0, room)
      .map((file) => ({
        localId: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type: kind,
        progress: 0,
        uploading: true,
      }));
    setSlots((prev) => [...prev, ...newSlots]);
    newSlots.forEach((slot) => {
      const context = kind === "video" ? "reel" : "post";
      const allowed = ACCEPT_BY_CONTEXT[context].split(",");
      const maxMB = MAX_SIZE_MB[context];
      if (!allowed.includes(slot.file.type)) {
        setSlots((prev) =>
          prev.map((s) =>
            s.localId === slot.localId
              ? { ...s, error: `File type "${slot.file.type}" is not supported.`, uploading: false }
              : s
          )
        );
        return;
      }
      if (slot.file.size > maxMB * 1024 * 1024) {
        setSlots((prev) =>
          prev.map((s) =>
            s.localId === slot.localId
              ? { ...s, error: `File must be under ${maxMB}MB. Your file is ${(slot.file.size / 1024 / 1024).toFixed(1)}MB.`, uploading: false }
              : s
          )
        );
        return;
      }
      uploadToGCS(slot.file, context, (pct) => {
        setSlots((prev) => prev.map((s) => (s.localId === slot.localId ? { ...s, progress: pct } : s)));
      })
        .then(({ url }) => {
          setSlots((prev) =>
            prev.map((s) => (s.localId === slot.localId ? { ...s, uploadedUrl: url ?? undefined, uploading: false } : s))
          );
        })
        .catch((e) => {
          setSlots((prev) =>
            prev.map((s) => (s.localId === slot.localId ? { ...s, error: humanizeError(e), uploading: false } : s))
          );
        });
    });
  }

  function removeSlot(localId: string) {
    setSlots((prev) => {
      const slot = prev.find((s) => s.localId === localId);
      if (slot && !initialMedia?.some((m) => m.url === slot.previewUrl)) {
        URL.revokeObjectURL(slot.previewUrl);
      }
      return prev.filter((s) => s.localId !== localId);
    });
  }

  const isUploading = slots.some((s) => s.uploading);
  const isEmpty = (editor?.isEmpty ?? true) && slots.every((s) => s.error);

  function handleSubmit() {
    if (!editor || isEmpty || isUploading) return;
    const media: PostMedia[] = slots
      .filter((s) => s.uploadedUrl)
      .map((s) => ({ url: s.uploadedUrl!, type: s.type }));
    onSubmit({ type, content_json: editor.getJSON(), media });
  }

  const slotsRef = useRef(slots);
  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    return () => {
      slotsRef.current.forEach((s) => {
        if (!initialMedia?.some((m) => m.url === s.previewUrl)) URL.revokeObjectURL(s.previewUrl);
      });
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {showTypeToggle && (
        <div className="flex gap-2">
          {(["post", "log"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 min-h-[44px] rounded border transition ${
                type === t ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
              }`}
            >
              {t === "log" ? "Training log" : "Update"}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-hair">
        <div className="flex items-center gap-1 border-b border-hairsoft p-1.5">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 min-h-[44px] min-w-[44px] rounded ${editor.isActive("bold") ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"}`}
            aria-label="Bold"><Bold className="h-4 w-4" /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 min-h-[44px] min-w-[44px] rounded ${editor.isActive("italic") ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"}`}
            aria-label="Italic"><Italic className="h-4 w-4" /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 min-h-[44px] min-w-[44px] rounded ${editor.isActive("bulletList") ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"}`}
            aria-label="Bullet list"><List className="h-4 w-4" /></button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 min-h-[44px] min-w-[44px] rounded ${editor.isActive("orderedList") ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"}`}
            aria-label="Numbered list"><ListOrdered className="h-4 w-4" /></button>
          <button type="button" onClick={() => {
              const url = window.prompt("Link URL");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={`p-2 min-h-[44px] min-w-[44px] rounded ${editor.isActive("link") ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"}`}
            aria-label="Link"><LinkIcon className="h-4 w-4" /></button>
        </div>
        <EditorContent editor={editor} className="prose prose-sm max-w-none px-3 py-2 min-h-[96px]" />
      </div>

      {slots.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slots.map((s) => (
            <div key={s.localId} className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-fill">
              {s.type === "image" ? (
                <img src={s.uploadedUrl ?? s.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <video src={s.uploadedUrl ?? s.previewUrl} className="h-full w-full object-cover" muted />
              )}
              {s.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Spinner className="h-5 w-5 text-white" />
                </div>
              )}
              {s.error && (
                <div className="absolute inset-0 flex items-center justify-center bg-red-900/70 text-[10px] text-white p-1 text-center">
                  {s.error}
                </div>
              )}
              <button type="button" onClick={() => removeSlot(s.localId)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                aria-label="Remove">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <label className="p-2 min-h-[44px] min-w-[44px] rounded text-ink-sub hover:bg-fill cursor-pointer flex items-center justify-center" aria-label="Add photo">
            <ImageIcon className="h-4 w-4" />
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only"
              onChange={(e) => { addFiles(e.target.files, "image"); e.target.value = ""; }} />
          </label>
          <label className="p-2 min-h-[44px] min-w-[44px] rounded text-ink-sub hover:bg-fill cursor-pointer flex items-center justify-center" aria-label="Add video">
            <VideoIcon className="h-4 w-4" />
            <input type="file" accept="video/mp4,video/webm,video/quicktime" multiple className="sr-only"
              onChange={(e) => { addFiles(e.target.files, "video"); e.target.value = ""; }} />
          </label>
        </div>
        <div className="flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="btn-secondary min-h-[44px]">Cancel</button>}
          <button type="button" onClick={handleSubmit} disabled={submitting || isEmpty || isUploading} className="btn-accent min-h-[44px]">
            {submitting ? "Posting…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
