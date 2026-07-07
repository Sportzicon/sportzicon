# Rich Post Composer + Dashboard Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the plain-textarea Feed post composer into an Instagram/LinkedIn-style rich composer (Tiptap WYSIWYG + mixed image/video carousel), make `/feed` the post-login landing page, and move the old stats Dashboard behind a "My Dashboard" entry in the profile dropdown.

**Architecture:** `PostDetail.text`/`media_urls` become `content_json` (Tiptap JSON doc) + `media` (typed `{url,type,thumbnail_url?}[]`) + a server-derived `text_excerpt`. A new `PostComposer` component (Tiptap editor + toolbar + multi-file media picker reusing existing upload plumbing) replaces the textarea in both create and edit flows. Rendering goes through a read-only Tiptap view (`PostContentView`) — never raw HTML — plus a new `MediaCarousel`. Nav/redirect targets move from `/dashboard` to `/feed`; the old Dashboard page is untouched, just relinked from the profile dropdown.

**Tech Stack:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link` (new deps, frontend only). Everything else reuses existing infra: `useUpload`/`uploadToGCS`, the `Content`/`PostDetail` Prisma model from Phase 5, Zod, React Query.

## Global Constraints

- No backend media-upload-endpoint changes — `media.schemas.ts`'s
  `UPLOAD_CONTEXTS`/`MAX_SIZE_MB_BY_CONTEXT`/`ALLOWED_TYPES_BY_CONTEXT` stay
  exactly as-is. Images upload via the existing `"post"` context (10MB),
  videos via the existing `"reel"` context (200MB) — chosen per-file by
  MIME type on the client.
- `content_json` is capped at 20,000 serialized bytes; `media` capped at 10
  items — both enforced in the Zod schema, matching the spec
  (`docs/superpowers/specs/2026-07-07-rich-post-composer-design.md`).
- Rendering is always via a read-only Tiptap `EditorContent`, never
  `dangerouslySetInnerHTML` — no HTML sanitization surface should be
  introduced anywhere in this plan.
- `cd backend && npm run typecheck` and `cd frontend && npm run typecheck &&
  npm run build` must both pass with zero errors before any task is
  considered done (per `CLAUDE.md` master rule 3).
- This DB has a known quirk: `npx prisma migrate dev` sometimes hangs with
  `P1002 timed out trying to acquire a postgres advisory lock` against this
  project's Supabase pooler. Task 1 documents the exact fallback that
  worked last time (Phase 5) if this recurs.

---

### Task 1: Data model — `PostDetail` schema change + migration

**Files:**
- Modify: `database/prisma/schema.prisma` (`PostDetail` model)
- Create: migration folder under `database/prisma/migrations/`

**Interfaces:**
- Produces: `PostDetail.content_json` (Json), `PostDetail.text_excerpt`
  (String, `@db.Text`), `PostDetail.media` (Json, default `[]`) — consumed
  by Task 3's service code and Task 2's Zod schemas.

- [ ] **Step 1: Edit the `PostDetail` model**

In `database/prisma/schema.prisma`, replace:

```prisma
model PostDetail {
  content_id String   @id @db.Uuid
  type       String   @default("post") // "post" | "log"
  text       String   @db.Text
  media_urls String[] @default([])

  content Content @relation(fields: [content_id], references: [id], onDelete: Cascade)

  @@schema("public")
}
```

with:

```prisma
model PostDetail {
  content_id   String @id @db.Uuid
  type         String @default("post") // "post" | "log"
  content_json Json
  text_excerpt String @db.Text
  media        Json   @default("[]")

  content Content @relation(fields: [content_id], references: [id], onDelete: Cascade)

  @@schema("public")
}
```

- [ ] **Step 2: Generate and apply the migration**

```bash
cd backend && npx prisma migrate dev --name post_rich_content --schema=../database/prisma/schema.prisma
```

Expected: creates `database/prisma/migrations/<timestamp>_post_rich_content/migration.sql`
dropping `text`/`media_urls` and adding `content_json`/`text_excerpt`/`media`
on `PostDetail`, applied cleanly (the table is empty — no real post content
exists yet).

**If this hangs with `P1002 ... timed out trying to acquire a postgres
advisory lock`** (a known quirk of this project's Supabase pooler, seen
during Phase 5): work around it instead of retrying blindly —

```bash
cd backend
npx prisma migrate diff --from-schema-datasource ../database/prisma/schema.prisma --to-schema-datamodel ../database/prisma/schema.prisma --script > /tmp/diff.sql
```

Hand-copy only the `PostDetail`-related statements from `/tmp/diff.sql`
(drop/add columns — ignore any unrelated drift the diff reports, e.g.
`search_vector` columns) into a new file
`database/prisma/migrations/<timestamp>_post_rich_content/migration.sql`,
then:

```bash
npx prisma db execute --schema=../database/prisma/schema.prisma --file ../database/prisma/migrations/<timestamp>_post_rich_content/migration.sql
```

Then record it in `_prisma_migrations` manually:

```bash
node -e "console.log(require('crypto').randomUUID())"
node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('../database/prisma/migrations/<timestamp>_post_rich_content/migration.sql')).digest('hex'))"
```

Write a second SQL file with the INSERT (using the UUID and checksum from
the two commands above) and apply it the same way via `prisma db execute`:

```sql
INSERT INTO "public"."_prisma_migrations"
  (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
VALUES
  ('<uuid-from-above>', '<checksum-from-above>', '<timestamp>_post_rich_content', now(), now(), 1);
```

- [ ] **Step 3: Regenerate both Prisma clients**

```bash
cd backend && npm run db:generate
cd ../scoring/backend && npm run db:generate
```

Expected: both print `Generated Prisma Client` with no errors.

- [ ] **Step 4: Verify**

```bash
cd backend && npx prisma migrate status --schema=../database/prisma/schema.prisma
```

Expected: `Database schema is up to date!`

- [ ] **Step 5: Commit**

```bash
git add database/prisma/schema.prisma database/prisma/migrations backend/prisma/schema.prisma scoring/backend/prisma/schema.prisma
git commit -m "feat(content): replace PostDetail.text/media_urls with content_json/media/text_excerpt"
```

---

### Task 2: Backend — rich-text util + Zod schemas

**Files:**
- Create: `backend/src/utils/richText.ts`
- Modify: `backend/src/modules/content/content.schemas.ts`

**Interfaces:**
- Produces: `extractPlainText(doc: TiptapNode, maxLen?: number): string`
  (from `richText.ts`) — consumed by Task 3.
- Produces: `postMediaItemSchema`, updated `createContentSchema`/
  `updateContentSchema` post branches — consumed by Task 3 and by
  `CreateContentInput`/`UpdateContentInput` types already exported from
  this file.

- [ ] **Step 1: Create `backend/src/utils/richText.ts`**

```ts
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
```

- [ ] **Step 2: Write a quick assert-based self-check for the util**

Append to the same file (`backend/src/utils/richText.ts`):

```ts
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
```

Run: `cd backend && npx tsx src/utils/richText.ts`
Expected: `richText.ts self-check passed`

- [ ] **Step 3: Update `content.schemas.ts`'s post branch**

In `backend/src/modules/content/content.schemas.ts`, replace:

```ts
const postFields = {
  type: z.enum(["log", "post"]).default("post"),
  text: z.string().min(1).max(2000).trim(),
  media_urls: z.array(z.string().url()).max(10).optional(),
  sport: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
};
```

with:

```ts
const tiptapDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.any()).default([]) })
  .passthrough()
  .refine((v) => JSON.stringify(v).length <= 20000, { message: "Content is too large" });

const postMediaItemSchema = z.object({
  url: z.string().url(),
  type: z.enum(["image", "video"]),
  thumbnail_url: z.string().url().optional(),
});

const postFields = {
  type: z.enum(["log", "post"]).default("post"),
  content_json: tiptapDocSchema,
  media: z.array(postMediaItemSchema).max(10).optional(),
  sport: z.string().max(60).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
};
```

Then replace the post branch inside `updateContentSchema`:

```ts
  z.object({
    content_type: z.literal("post"),
    text: z.string().min(1).max(4000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  }),
```

with:

```ts
  z.object({
    content_type: z.literal("post"),
    content_json: tiptapDocSchema.optional(),
    media: z.array(postMediaItemSchema).max(10).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
  }),
```

- [ ] **Step 4: Typecheck**

```bash
cd backend && npm run typecheck
```

Expected: no errors (this file has no other consumers yet until Task 3).

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/richText.ts backend/src/modules/content/content.schemas.ts
git commit -m "feat(content): add rich-text plain-text extractor and post_json/media Zod schemas"
```

---

### Task 3: Backend — wire `content.service.ts` + update integration test

**Files:**
- Modify: `backend/src/modules/content/content.service.ts`
- Modify: `backend/tests/integration/posts.test.ts`

**Interfaces:**
- Consumes: `extractPlainText` (Task 2), `tiptapDocSchema`/
  `postMediaItemSchema` via `CreateContentInput`/`UpdateContentInput`
  (Task 2).
- Produces: `createContent`/`updateContent` now read/write
  `content_json`/`media`/`text_excerpt` — consumed by `flattenContent`
  (unchanged — it already spreads whatever fields `postDetail` carries).

- [ ] **Step 1: Update imports in `content.service.ts`**

At the top of `backend/src/modules/content/content.service.ts`, replace:

```ts
import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { slugify } from "../../utils/ids";
import { eventBus } from "../../lib/EventBus";
import { CONTENT_LIKED, type ContentLikedEvent } from "../../events/types";
import type { CreateContentInput, ListContentInput, UpdateContentInput } from "./content.schemas";
```

with:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { BadRequest, Forbidden, NotFound } from "../../utils/errors";
import { slugify } from "../../utils/ids";
import { extractPlainText } from "../../utils/richText";
import { eventBus } from "../../lib/EventBus";
import { CONTENT_LIKED, type ContentLikedEvent } from "../../events/types";
import type { CreateContentInput, ListContentInput, UpdateContentInput } from "./content.schemas";
```

- [ ] **Step 2: Update `createContent`'s post branch**

Replace:

```ts
  if (input.content_type === "post") {
    const content = await prisma.content.create({
      data: {
        author_id: authorId,
        content_type: "post",
        sport: input.sport,
        tags: input.tags ?? [],
        postDetail: {
          create: {
            type: input.type,
            text: input.text.trim(),
            media_urls: input.media_urls ?? [],
          },
        },
      },
      include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT } },
    });
    return flattenContent(content);
  }
```

with:

```ts
  if (input.content_type === "post") {
    const content = await prisma.content.create({
      data: {
        author_id: authorId,
        content_type: "post",
        sport: input.sport,
        tags: input.tags ?? [],
        postDetail: {
          create: {
            type: input.type,
            content_json: input.content_json as Prisma.InputJsonValue,
            text_excerpt: extractPlainText(input.content_json),
            media: (input.media ?? []) as Prisma.InputJsonValue,
          },
        },
      },
      include: { ...DETAIL_INCLUDE, author: { select: AUTHOR_SELECT } },
    });
    return flattenContent(content);
  }
```

- [ ] **Step 3: Update `updateContent`'s post branch**

Replace:

```ts
  if (input.content_type === "post") {
    const detailData: Record<string, unknown> = {};
    if (input.text !== undefined) detailData.text = input.text;

    const ops = [];
    if (input.tags !== undefined) ops.push(prisma.content.update({ where: { id }, data: { tags: input.tags } }));
    if (Object.keys(detailData).length) ops.push(prisma.postDetail.update({ where: { content_id: id }, data: detailData }));
    if (ops.length) await prisma.$transaction(ops);
    return { ok: true };
  }
```

with:

```ts
  if (input.content_type === "post") {
    const detailData: Record<string, unknown> = {};
    if (input.content_json !== undefined) {
      detailData.content_json = input.content_json as Prisma.InputJsonValue;
      detailData.text_excerpt = extractPlainText(input.content_json);
    }
    if (input.media !== undefined) detailData.media = input.media as Prisma.InputJsonValue;

    const ops = [];
    if (input.tags !== undefined) ops.push(prisma.content.update({ where: { id }, data: { tags: input.tags } }));
    if (Object.keys(detailData).length) ops.push(prisma.postDetail.update({ where: { content_id: id }, data: detailData }));
    if (ops.length) await prisma.$transaction(ops);
    return { ok: true };
  }
```

- [ ] **Step 4: Typecheck**

```bash
cd backend && npm run typecheck
```

Expected: zero errors. `flattenContent` needs no change — it already
spreads whatever fields the joined detail row carries.

- [ ] **Step 5: Update the integration test**

In `backend/tests/integration/posts.test.ts`, replace the whole file with:

```ts
import { api, signupAndLogin } from "../helpers/agent";
import { resetDatabase } from "../helpers/setup";

const DOC = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("content: posts + reels + blogs", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  test("post -> like -> comment lifecycle", async () => {
    const a = await signupAndLogin({ email: "p@test.dev" });
    const create = await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({ content_type: "post", type: "log", content_json: DOC("Speed work today. 6x200m.") })
      .expect(201);
    const id = create.body.content.id;
    expect(create.body.content.text_excerpt).toBe("Speed work today. 6x200m.");

    await api().post(`/api/v1/content/${id}/like`).set(a.auth).expect(200);
    await api().post(`/api/v1/content/${id}/comments`).set(a.auth).send({ text: "Solid." }).expect(201);

    const list = await api().get(`/api/v1/content/${id}/comments`).set(a.auth).expect(200);
    expect(list.body.data.length).toBe(1);
  });

  test("only author or admin can delete a post", async () => {
    const a = await signupAndLogin({ email: "owner@test.dev" });
    const b = await signupAndLogin({ email: "other@test.dev" });
    const r = await api().post("/api/v1/content").set(a.auth).send({ content_type: "post", content_json: DOC("hi") }).expect(201);
    const id = r.body.content.id;
    const denied = await api().delete(`/api/v1/content/${id}`).set(b.auth);
    expect(denied.status).toBe(403);
    await api().delete(`/api/v1/content/${id}`).set(a.auth).expect(200);
  });

  test("post media carries per-item type", async () => {
    const a = await signupAndLogin({ email: "media@test.dev" });
    const r = await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({
        content_type: "post",
        content_json: DOC("carousel test"),
        media: [
          { url: "https://example.com/a.jpg", type: "image" },
          { url: "https://example.com/b.mp4", type: "video" },
        ],
      })
      .expect(201);
    expect(r.body.content.media).toEqual([
      { url: "https://example.com/a.jpg", type: "image" },
      { url: "https://example.com/b.mp4", type: "video" },
    ]);
  });

  test("blog draft is hidden from public list", async () => {
    const a = await signupAndLogin({ email: "blogger@test.dev" });
    await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({
        content_type: "blog",
        title: "Draft post",
        body_markdown: "# Hello world this is enough characters for the validator.",
        status: "draft"
      })
      .expect(201);
    const list = await api().get("/api/v1/content").set(a.auth).query({ content_type: "blog" }).expect(200);
    expect(list.body.items.length).toBe(0);
  });

  test("reel create and list", async () => {
    const a = await signupAndLogin({ email: "reeler@test.dev" });
    await api()
      .post("/api/v1/content")
      .set(a.auth)
      .send({ content_type: "reel", video_url: "https://example.com/v.mp4", title: "Free kick" })
      .expect(201);
    const list = await api().get("/api/v1/content").set(a.auth).query({ content_type: "reel" }).expect(200);
    expect(list.body.items.length).toBe(1);
  });
});
```

- [ ] **Step 6: Run the test (requires a local/test `DATABASE_URL`)**

```bash
cd backend && npm test -- --testPathPattern="posts"
```

Expected: all 5 tests pass. If `DATABASE_URL` doesn't contain `localhost`
or `test`, `resetDatabase()` refuses to run (existing safety guard,
documented in `CLAUDE.md`) — this is expected in environments without a
local test DB; typecheck passing is the fallback bar in that case.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/content/content.service.ts backend/tests/integration/posts.test.ts
git commit -m "feat(content): wire content_json/media through post create/update"
```

---

### Task 4: Frontend — install Tiptap, update `Post` model types

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/models/post.model.ts`

**Interfaces:**
- Produces: `PostMedia` interface, updated `Post`/`CreatePostRequest`/
  `UpdatePostRequest` — consumed by every task from here on.

- [ ] **Step 1: Install dependencies**

```bash
cd frontend && npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

Expected: `package.json`'s `dependencies` gains all three; no peer-dependency
warnings for React 18.

- [ ] **Step 2: Rewrite `frontend/src/models/post.model.ts`**

Replace the entire file with:

```ts
import type { Role } from "./user.model";
import type { JSONContent } from "@tiptap/react";

export interface PostAuthor {
  id: string;
  full_name: string;
  role: Role;
  profile_photo_url?: string;
}

export interface PostMedia {
  url: string;
  type: "image" | "video";
  thumbnail_url?: string;
}

export interface Post {
  id: string;
  author_id: string;
  author?: PostAuthor;
  author_name?: string;
  author_role?: Role;
  type: "log" | "post";
  content_json: JSONContent;
  media: PostMedia[];
  sport?: string;
  tags?: string[];
  like_count: number;
  comment_count: number;
  created_at: string | number;
}

export interface CreatePostRequest {
  type: "log" | "post";
  content_json: JSONContent;
  media?: PostMedia[];
  sport?: string;
  tags?: string[];
}

export interface UpdatePostRequest {
  content_json?: JSONContent;
  media?: PostMedia[];
  tags?: string[];
}
```

- [ ] **Step 3: Update `useFeed.ts`'s `update` mutation to the new shape**

In `frontend/src/modules/feed/hooks/useFeed.ts`, replace:

```ts
  const update = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => postService.update(id, { text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });
```

with:

```ts
  const update = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePostRequest) => postService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() }),
  });
```

And update the import line at the top of the same file — replace:

```ts
import type { CreatePostRequest, Post } from "../../../models";
```

with:

```ts
import type { CreatePostRequest, Post, UpdatePostRequest } from "../../../models";
```

- [ ] **Step 4: Typecheck (expect failures — that's the point)**

```bash
cd frontend && npx tsc --noEmit
```

Expected: errors in `Feed.tsx` and `ProfileFeedTab.tsx` (`p.text`/
`p.media_urls` no longer exist on `Post`). This confirms the type change
took effect — Tasks 5-8 fix these call sites.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/models/post.model.ts frontend/src/modules/feed/hooks/useFeed.ts
git commit -m "feat(post): add Tiptap deps, replace Post.text/media_urls with content_json/media"
```

---

### Task 5: Frontend — `PostComposer` component

**Files:**
- Create: `frontend/src/modules/feed/components/PostComposer.tsx`

**Interfaces:**
- Consumes: `uploadToGCS(file, context, onProgress)` from
  `frontend/src/hooks/useUpload.ts` (existing, signature:
  `(file: File, context: UploadContext, onProgress?: (pct: number) => void) => Promise<{key: string; url: string | null}>`).
- Produces: `PostComposer` component — consumed by Task 7 (`Feed.tsx`).
  Props: `{ showTypeToggle?: boolean; initialType?: "post"|"log";
  initialContentJson?: JSONContent; initialMedia?: PostMedia[]; submitting:
  boolean; submitLabel: string; onSubmit: (data: {type: "post"|"log";
  content_json: JSONContent; media: PostMedia[]}) => void; onCancel?: () =>
  void }`.

- [ ] **Step 1: Create the component**

```tsx
import { useEffect, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Image as ImageIcon, Video as VideoIcon, X } from "lucide-react";
import { uploadToGCS } from "../../../hooks/useUpload";
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
      uploadToGCS(slot.file, kind === "video" ? "reel" : "post", (pct) => {
        setSlots((prev) => prev.map((s) => (s.localId === slot.localId ? { ...s, progress: pct } : s)));
      })
        .then(({ url }) => {
          setSlots((prev) =>
            prev.map((s) => (s.localId === slot.localId ? { ...s, uploadedUrl: url ?? undefined, uploading: false } : s))
          );
        })
        .catch((e: Error) => {
          setSlots((prev) =>
            prev.map((s) => (s.localId === slot.localId ? { ...s, error: e.message, uploading: false } : s))
          );
        });
    });
  }

  function removeSlot(localId: string) {
    setSlots((prev) => prev.filter((s) => s.localId !== localId));
  }

  const isUploading = slots.some((s) => s.uploading);
  const isEmpty = (editor?.isEmpty ?? true) && slots.length === 0;

  function handleSubmit() {
    if (!editor || isEmpty || isUploading) return;
    const media: PostMedia[] = slots
      .filter((s) => s.uploadedUrl)
      .map((s) => ({ url: s.uploadedUrl!, type: s.type }));
    onSubmit({ type, content_json: editor.getJSON(), media });
  }

  useEffect(() => {
    return () => {
      slots.forEach((s) => {
        if (!initialMedia?.some((m) => m.url === s.previewUrl)) URL.revokeObjectURL(s.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors from this file (the pre-existing `Feed.tsx`/
`ProfileFeedTab.tsx` errors from Task 4 remain until Tasks 7-8).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/modules/feed/components/PostComposer.tsx
git commit -m "feat(post): add PostComposer (Tiptap toolbar + multi-file media picker)"
```

---

### Task 6: Frontend — `MediaCarousel` + `PostContentView`

**Files:**
- Create: `frontend/src/modules/feed/components/MediaCarousel.tsx`
- Create: `frontend/src/modules/feed/components/PostContentView.tsx`

**Interfaces:**
- Produces: `MediaCarousel({media: PostMedia[]})`, `PostContentView({content:
  JSONContent})` — both consumed by Task 7 (`Feed.tsx`) and Task 8
  (`ProfileFeedTab.tsx`).

- [ ] **Step 1: Create `MediaCarousel.tsx`**

```tsx
import type { PostMedia } from "../../../models";

export function MediaCarousel({ media }: { media: PostMedia[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory rounded-lg">
      {media.map((m, i) => (
        <div key={i} className="flex-shrink-0 w-full snap-center">
          {m.type === "image" ? (
            <img src={m.url} alt="" className="w-full max-h-80 object-cover rounded-lg" loading="lazy" />
          ) : (
            <video src={m.url} controls className="w-full max-h-80 object-cover rounded-lg" />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `PostContentView.tsx`**

```tsx
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
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors from these two files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/feed/components/MediaCarousel.tsx frontend/src/modules/feed/components/PostContentView.tsx
git commit -m "feat(post): add MediaCarousel and read-only PostContentView renderers"
```

---

### Task 7: Frontend — wire `Feed.tsx` to the new composer/renderers

**Files:**
- Modify: `frontend/src/modules/feed/pages/Feed.tsx`

**Interfaces:**
- Consumes: `PostComposer` (Task 5), `MediaCarousel`/`PostContentView`
  (Task 6), updated `useFeed()` (Task 4).

- [ ] **Step 1: Update imports**

Replace:

```ts
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, PenLine, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { humanizeError } from "../../../api/client";
import type { Post } from "../../../models";
```

with:

```ts
import { Heart, Trash2, MoreVertical, MessageCircle, PenLine, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { humanizeError } from "../../../api/client";
import { PostComposer } from "../components/PostComposer";
import { PostContentView } from "../components/PostContentView";
import { MediaCarousel } from "../components/MediaCarousel";
import type { Post, PostMedia } from "../../../models";
import type { JSONContent } from "@tiptap/react";
```

(`Pencil` is dropped from the icon import — the edit affordance still uses
`MoreVertical`'s menu, `Pencil` was only used inside that menu button,
which stays; check after Step 2 whether it's still referenced — it is, in
the "Edit" menu item, so **do not remove `Pencil`**. Correct import line:)

```ts
import { Heart, Trash2, Pencil, MoreVertical, MessageCircle, PenLine, RefreshCw } from "lucide-react";
```

- [ ] **Step 2: Update `PostCard`'s body (text/media block)**

Replace:

```tsx
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = currentUserId === p.author_id;
  const longText = p.text.length > 300;
```

with:

```tsx
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = currentUserId === p.author_id;
```

Replace:

```tsx
      {/* Post text with read-more */}
      <div className="mt-3">
        <p
          className={`text-[14.5px] text-ink-70 leading-relaxed whitespace-pre-wrap ${
            !expanded && longText ? "line-clamp-3" : ""
          }`}
        >
          {p.text}
        </p>
        {longText && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-brand-500 text-sm mt-1 min-h-[44px] flex items-center"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </div>

      {/* Media */}
      {p.media_urls && p.media_urls.length > 0 && (
        <div className="mt-3 space-y-2">
          {p.media_urls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="w-full max-h-80 object-cover rounded-lg"
              loading="lazy"
            />
          ))}
        </div>
      )}
```

with:

```tsx
      {/* Post content */}
      <div className="mt-3">
        <PostContentView content={p.content_json} />
      </div>

      <MediaCarousel media={p.media} />
```

(Read-more truncation is dropped for rich content in this pass — not part
of the approved spec's scope; flag as a known simplification, not a silent
omission.)

- [ ] **Step 3: Replace the create-form composer**

Remove the `text`/`type`/`charsLeft`/`MAX_CHARS` state and `createForm`
block. Replace:

```tsx
  const { feedQuery, posts, create, update, remove, toggleLike, likedPosts } = useFeed();
  const [text, setText] = useState("");
  const [type, setType] = useState<"post" | "log">("post");
  const [tab, setTab] = useState("All");
```

with:

```tsx
  const { feedQuery, posts, create, update, remove, toggleLike, likedPosts } = useFeed();
  const [tab, setTab] = useState("All");
```

Remove this line entirely (no longer needed):

```tsx
  const charsLeft = MAX_CHARS - text.length;
```

Replace:

```tsx
  const handleCreate = () => {
    if (!text.trim()) return;
    setCreateError("");
    create.mutate(
      { type, text: text.trim() },
      {
        onSuccess: () => {
          setText("");
          setCreateOpen(false);
        },
        onError: (err) => setCreateError(humanizeError(err)),
      }
    );
  };

  const createForm = (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["post", "log"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`font-mononum text-[10px] uppercase tracking-[0.08em] px-3 min-h-[44px] rounded border transition ${
              type === t
                ? "bg-ink text-paper border-ink"
                : "border-hair text-ink-sub hover:border-ink hover:text-ink"
            }`}
          >
            {t === "log" ? "Training log" : "Update"}
          </button>
        ))}
      </div>
      <div>
        <textarea
          className="input w-full"
          rows={4}
          placeholder={type === "log" ? "What did you train today?" : "Share an update with your network…"}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          style={{ resize: "none" }}
        />
        <div className={`text-right text-xs mt-1 ${charsLeft < 200 ? "text-red-500" : "text-ink-faint"}`}>
          {text.length}/{MAX_CHARS}
        </div>
      </div>
      {createError && <p className="text-sm text-red-600">{createError}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setCreateOpen(false); setText(""); setCreateError(""); }}
          className="btn-secondary min-h-[44px]"
        >
          Cancel
        </button>
        <button
          className="btn-accent min-h-[44px]"
          disabled={create.isPending || !text.trim()}
          onClick={handleCreate}
        >
          {create.isPending ? "Posting…" : "Post →"}
        </button>
      </div>
    </div>
  );
```

with:

```tsx
  const handleCreate = (data: { type: "post" | "log"; content_json: JSONContent; media: PostMedia[] }) => {
    setCreateError("");
    create.mutate(data, {
      onSuccess: () => setCreateOpen(false),
      onError: (err) => setCreateError(humanizeError(err)),
    });
  };

  const createForm = (
    <div className="space-y-3">
      <PostComposer
        submitting={create.isPending}
        submitLabel="Post →"
        onSubmit={handleCreate}
        onCancel={() => setCreateOpen(false)}
      />
      {createError && <p className="text-sm text-red-600">{createError}</p>}
    </div>
  );
```

- [ ] **Step 4: Replace the inline edit form**

Replace:

```tsx
              if (editingId === p.id) {
                return (
                  <li key={p.id} className="panel p-4 sm:p-5">
                    <p className="text-sm font-semibold text-ink mb-2">Edit post</p>
                    <textarea
                      id={`edit-${p.id}`}
                      defaultValue={p.text}
                      className="input w-full text-sm"
                      rows={4}
                      maxLength={MAX_CHARS}
                      style={{ resize: "none" }}
                    />
                    <div className="flex gap-2 justify-end mt-2">
                      <button onClick={() => setEditingId(null)} className="btn-secondary min-h-[44px]">
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const el = document.getElementById(`edit-${p.id}`) as HTMLTextAreaElement;
                          update.mutate(
                            { id: p.id, text: el.value },
                            { onSuccess: () => setEditingId(null) }
                          );
                        }}
                        disabled={update.isPending}
                        className="btn-primary min-h-[44px]"
                      >
                        {update.isPending ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </li>
                );
              }
```

with:

```tsx
              if (editingId === p.id) {
                return (
                  <li key={p.id} className="panel p-4 sm:p-5">
                    <p className="text-sm font-semibold text-ink mb-2">Edit post</p>
                    <PostComposer
                      showTypeToggle={false}
                      initialContentJson={p.content_json}
                      initialMedia={p.media}
                      submitting={update.isPending}
                      submitLabel="Save"
                      onSubmit={(data) =>
                        update.mutate(
                          { id: p.id, content_json: data.content_json, media: data.media },
                          { onSuccess: () => setEditingId(null) }
                        )
                      }
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                );
              }
```

- [ ] **Step 5: Remove the now-unused `MAX_CHARS` constant**

Remove the line near the top of the file:

```ts
const MAX_CHARS = 2000;
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors remaining in `Feed.tsx`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/modules/feed/pages/Feed.tsx
git commit -m "feat(post): wire PostComposer/PostContentView/MediaCarousel into Feed page"
```

---

### Task 8: Frontend — wire `ProfileFeedTab.tsx`'s post branch

**Files:**
- Modify: `frontend/src/modules/profile/components/ProfileFeedTab.tsx`

**Interfaces:**
- Consumes: `PostContentView`, `MediaCarousel` (Task 6).

- [ ] **Step 1: Add imports**

Add to the top of `frontend/src/modules/profile/components/ProfileFeedTab.tsx`:

```ts
import { PostContentView } from "../../feed/components/PostContentView";
import { MediaCarousel } from "../../feed/components/MediaCarousel";
```

- [ ] **Step 2: Replace the post branch's rendering**

Replace:

```tsx
        if (item.kind === "post") {
          const p = item.data;
          return (
            <div key={`post-${p.id}`} className="card card-body">
              <Badge color="blue">Post</Badge>
              <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-70">{p.text}</p>
              {p.media_urls?.[0] && (
                <img src={p.media_urls[0]} alt="" className="mt-3 max-h-80 w-full rounded object-cover" />
              )}
              <CountsRow likes={p.like_count} comments={p.comment_count} at={item.at} />
            </div>
          );
        }
```

with:

```tsx
        if (item.kind === "post") {
          const p = item.data;
          return (
            <div key={`post-${p.id}`} className="card card-body">
              <Badge color="blue">Post</Badge>
              <div className="mt-2.5">
                <PostContentView content={p.content_json} />
              </div>
              <MediaCarousel media={p.media} />
              <CountsRow likes={p.like_count} comments={p.comment_count} at={item.at} />
            </div>
          );
        }
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: zero errors anywhere in the frontend now — this closes out all
the type errors introduced by Task 4.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/modules/profile/components/ProfileFeedTab.tsx
git commit -m "feat(post): render rich post content in Profile activity tab"
```

---

### Task 9: Navigation — `/feed` becomes the landing page, "My Dashboard" moves to the profile dropdown

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/modules/auth/pages/Login.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`

**Interfaces:** None — pure routing/link changes, no new components.

- [ ] **Step 1: `Login.tsx` — redirect targets**

Replace:

```tsx
  if (user && accessToken) return <Navigate to="/dashboard" replace />;
```

with:

```tsx
  if (user && accessToken) return <Navigate to="/feed" replace />;
```

Replace:

```tsx
      navigate("/dashboard", { replace: true });
```

with:

```tsx
      navigate("/feed", { replace: true });
```

- [ ] **Step 2: `ProtectedRoute.tsx` — role-mismatch fallback**

Replace:

```tsx
  if (roles && !hasRole(user.role, ...roles)) return <Navigate to="/dashboard" replace />;
```

with:

```tsx
  if (roles && !hasRole(user.role, ...roles)) return <Navigate to="/feed" replace />;
```

- [ ] **Step 3: `Layout.tsx` — header logo link**

Replace:

```tsx
          <Link to="/dashboard" aria-label="Sportzicon" className="flex items-center flex-shrink-0">
```

with:

```tsx
          <Link to="/feed" aria-label="Sportzicon" className="flex items-center flex-shrink-0">
```

- [ ] **Step 4: `Layout.tsx` — desktop sidebar `navItems`**

Replace:

```tsx
  const navItems = [
    { to: isAdmin(user.role) ? "/admin" : "/dashboard", icon: <Home className="h-4 w-4" />, label: "Dashboard" },
    { to: "/live-scores",  icon: <Activity className="h-4 w-4" />,      label: "Live Scores" },
```

with:

```tsx
  const navItems = [
    ...(isAdmin(user.role) ? [{ to: "/admin", icon: <Home className="h-4 w-4" />, label: "Dashboard" }] : []),
    { to: "/live-scores",  icon: <Activity className="h-4 w-4" />,      label: "Live Scores" },
```

(Non-admin users no longer see a "Dashboard" sidebar entry — its content
now lives behind the profile dropdown's "My Dashboard". Admins keep their
existing direct link to `/admin` unchanged.)

- [ ] **Step 5: `Layout.tsx` — mobile bottom nav `base`/duplicate "Feed" entries**

Replace:

```tsx
  const base = [
    { to: "/dashboard",   icon: <Home className="h-5 w-5" />,          label: "Home" },
  ];
```

with:

```tsx
  const base = [
    { to: "/feed",   icon: <Home className="h-5 w-5" />,          label: "Home" },
  ];
```

Then, since "Home" and "Feed" are now the same destination, drop the
now-redundant explicit "Feed" tab from the two roles that had both. Replace
the scout branch:

```tsx
  if (user.role === "scout") {
    return [
      ...base,
      { to: "/search", icon: <Search className="h-5 w-5" />,           label: "Search" },
      { to: "/feed",   icon: <FileText className="h-5 w-5" />,         label: "Feed" },
      { to: "/messages", icon: <MessageCircle className="h-5 w-5" />,  label: "Messages" },
      { to: profileTo,  icon: <UserIcon className="h-5 w-5" />,        label: "Profile" },
    ];
  }
```

with:

```tsx
  if (user.role === "scout") {
    return [
      ...base,
      { to: "/search", icon: <Search className="h-5 w-5" />,           label: "Search" },
      { to: "/messages", icon: <MessageCircle className="h-5 w-5" />,  label: "Messages" },
      { to: profileTo,  icon: <UserIcon className="h-5 w-5" />,        label: "Profile" },
    ];
  }
```

And the athlete (default) branch:

```tsx
  // athlete (default)
  return [
    ...base,
    { to: "/opportunities", icon: <Briefcase className="h-5 w-5" />,    label: "Trials" },
    { to: "/feed",          icon: <FileText className="h-5 w-5" />,     label: "Feed" },
    { to: "/messages",      icon: <MessageCircle className="h-5 w-5" />,label: "Messages" },
    { to: profileTo,        icon: <UserIcon className="h-5 w-5" />,     label: "Profile" },
  ];
```

with:

```tsx
  // athlete (default)
  return [
    ...base,
    { to: "/opportunities", icon: <Briefcase className="h-5 w-5" />,    label: "Trials" },
    { to: "/messages",      icon: <MessageCircle className="h-5 w-5" />,label: "Messages" },
    { to: profileTo,        icon: <UserIcon className="h-5 w-5" />,     label: "Profile" },
  ];
```

(Club/organizer branches don't have a separate "/feed" entry today, so
they're untouched — their "Home" tab now just points to `/feed` via
`base`.)

- [ ] **Step 6: `Layout.tsx` — add "My Dashboard" to the profile dropdown**

Replace:

```tsx
              {profileMenuOpen && (
                <div className="absolute right-0 mt-1 panel shadow-pop z-50 min-w-[160px]">
                  <NavLink to={`/profile/${user.id}`} onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                    <UserIcon className="h-3.5 w-3.5" /> View profile
                  </NavLink>
                  <button onClick={() => { setProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </button>
                </div>
              )}
```

with:

```tsx
              {profileMenuOpen && (
                <div className="absolute right-0 mt-1 panel shadow-pop z-50 min-w-[160px]">
                  <NavLink to="/dashboard" onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                    <Home className="h-3.5 w-3.5" /> My Dashboard
                  </NavLink>
                  <NavLink to={`/profile/${user.id}`} onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft">
                    <UserIcon className="h-3.5 w-3.5" /> View profile
                  </NavLink>
                  <button onClick={() => { setProfileMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50">
                    <LogOut className="h-3.5 w-3.5" /> Log out
                  </button>
                </div>
              )}
```

(`Home` icon is already imported in this file — it's used at line 205/322
today — so no new import is needed. For admins, `/dashboard` still
correctly redirects to `/admin` via `Dashboard.tsx`'s existing
`isAdmin` check, so this one link works for every role without a
conditional.)

- [ ] **Step 7: Typecheck + build**

```bash
cd frontend && npm run build
```

Expected: `tsc --noEmit` and `vite build` both succeed with zero errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/modules/auth/pages/Login.tsx frontend/src/components/ProtectedRoute.tsx
git commit -m "feat(nav): make /feed the post-login landing page, move Dashboard to profile menu"
```

---

### Task 10: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + build both apps**

```bash
cd backend && npm run typecheck
cd frontend && npm run build
```

Expected: zero errors in both.

- [ ] **Step 2: Backend integration tests (if a local/test DB is available)**

```bash
cd backend && npm test -- --testPathPattern="posts"
```

Expected: all pass (per Task 3, Step 6).

- [ ] **Step 3: Manual browser pass**

Per `CLAUDE.md`'s UI-verification rule and the pattern established in
Phase 5 (isolated backend + frontend dev instances on alternate ports so
the user's own running dev servers are untouched — see the `run` skill and
`dev-browser` skill):

1. Log in — confirm landing lands on `/feed`, not `/dashboard`.
2. In the Feed composer: type bold text (toolbar Bold button), add a
   bullet list, attach 2 images and 1 video, submit. Confirm the post
   renders with correct formatting and a swipeable media carousel.
3. Edit that post — confirm the composer opens pre-filled with the same
   rich content and media, and re-saving works.
4. Open the profile dropdown (top-right avatar) — confirm "My Dashboard"
   appears above "View profile" and opens the unchanged stats page.
5. Open own Profile → Feed tab — confirm the same rich post renders there
   too (via `PostContentView`/`MediaCarousel`).
6. Check the browser console for errors throughout.
7. Delete the test post afterward via the API (same cleanup pattern as
   Phase 5) so no test data is left in the shared DB.

- [ ] **Step 4: Final commit (if any fixups were needed during manual verification)**

```bash
git add -A
git commit -m "fix(post): address issues found in manual verification pass"
```

(Skip this step if no fixups were needed.)
