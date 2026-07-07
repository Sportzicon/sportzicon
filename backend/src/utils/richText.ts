export interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

/** Walks a Tiptap/ProseMirror JSON doc and concatenates its text nodes into a plain string. */
export function extractPlainText(doc: TiptapNode, maxLen = 280): string {
  const parts: string[] = [];
  function walk(node: TiptapNode) {
    if (node.text) parts.push(node.text);
    node.content?.forEach(walk);
  }
  walk(doc);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

if (require.main === module) {
  const assert = require("node:assert");
  const doc: TiptapNode = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item one" }] }] }] },
    ],
  };
  assert.strictEqual(extractPlainText(doc), "Hello world item one");
  assert.strictEqual(extractPlainText({ type: "doc", content: [{ type: "paragraph", text: "x".repeat(400) }] }, 280).length, 280);
  console.log("richText.ts self-check passed");
}
