import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Quote, Code, Heading2, Heading3,
  Link as LinkIcon, Undo2, Redo2, Image as ImageIcon, Video as VideoIcon, X,
} from "lucide-react";
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
  initialContentJson?: JSONContent;
  initialMedia?: PostMedia[];
  submitting: boolean;
  submitLabel: string;
  onSubmit: (data: { content_json: JSONContent; media: PostMedia[] }) => void;
  onCancel?: () => void;
}

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-2 min-h-[44px] min-w-[44px] flex-shrink-0 rounded transition disabled:opacity-30 ${
        active ? "bg-fill text-ink" : "text-ink-sub hover:bg-fill"
      }`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px self-stretch my-1.5 bg-hairsoft flex-shrink-0" />;
}

export function PostComposer({
  initialContentJson,
  initialMedia,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: PostComposerProps) {
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
    extensions: [StarterKit, Link, Underline],
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
    onSubmit({ content_json: editor.getJSON(), media });
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
      <div className="rounded-lg border border-hair">
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-hairsoft p-1.5">
          <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={editor.isActive("link")}
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarDivider />

          <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} className="prose prose-sm max-w-none px-3 py-2.5 min-h-[200px]" />
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
