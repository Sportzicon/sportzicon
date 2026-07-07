import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export function PostContentView({ content }: { content: JSONContent }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit, Link],
    content,
  });

  if (!editor) return null;
  return <EditorContent editor={editor} className="prose prose-sm max-w-none text-[14.5px] text-ink-70" />;
}
