# Rich Post Composer + Dashboard Relocation — Design

## Context

Phase 5 (`docs/SCALING_PLAN.md`) just unified `Post`/`Blog`/`Reel` onto one
`Content` model. This spec is the next step for the `post` content type
specifically: turn today's plain-textarea Feed composer into an
Instagram/LinkedIn-style rich composer (styled text + mixed image/video
carousel in one post), and make the activity feed the new post-login
landing page instead of the current stats-only Dashboard.

Today: `Dashboard` (role-specific stats/quick-links) is the post-login
landing route (`/dashboard`) and the sidebar's "Home" link. `Feed` (posts
composer + list) is a separate page at `/feed`, reached only via its own
sidebar nav item. The composer there is a plain `<textarea>` with no
image/video upload and no text styling.

## Decisions made during brainstorming

- **Dashboard relocation**: `Dashboard.tsx` and its route are untouched —
  only its *entry point* moves. A new "My Dashboard" link is added to the
  profile dropdown menu (`Layout.tsx`, `profileMenuOpen` panel), directly
  above "View profile", pointing at the existing `/dashboard` route.
- **New landing page**: `/feed` becomes the destination for the post-login
  redirect (`Login.tsx`), the sidebar "Home" nav item, and the header logo
  link — all three currently point at `/dashboard`.
- **Rich text**: full WYSIWYG editor, not markdown-with-toolbar. New
  dependency: `@tiptap/react` + `@tiptap/starter-kit` (Bold, Italic,
  Bullet list, Numbered list, Link — StarterKit's defaults, no extra
  extensions needed for this scope).
- **Media mix**: any combination of images and videos in one post, any
  count (capped at 10 items, matching today's `media_urls` cap). This is
  Instagram-carousel-like, not "one video XOR many images."
- **Upload plumbing**: reuse `useUpload`/`uploadToGCS` exactly as they
  exist today. Images upload through the existing `"post"` upload context
  (10MB cap), videos through the existing `"reel"` upload context (200MB
  cap) — chosen per-file by MIME type on the client. **No backend
  media-module changes** (`media.schemas.ts`'s `UPLOAD_CONTEXTS`/
  `MAX_SIZE_MB_BY_CONTEXT`/`ALLOWED_TYPES_BY_CONTEXT` stay exactly as-is).
- **Rendering safety**: rich content renders through a read-only Tiptap
  `EditorContent` fed the same JSON doc used for editing — never
  `dangerouslySetInnerHTML` on raw HTML. This sidesteps the XSS-sanitization
  question entirely (Tiptap only ever renders nodes/marks its own schema
  defines), consistent with `SECURITY_RULES.md`'s XSS checklist item.

## Data model changes

`PostDetail` (in `database/prisma/schema.prisma`):

```prisma
model PostDetail {
  content_id   String   @id @db.Uuid
  type         String   @default("post") // "post" | "log" — unchanged
  content_json Json                       // Tiptap doc — replaces `text`
  text_excerpt String   @db.Text          // plain-text extract, server-derived
  media        Json     @default("[]")    // [{url, type: "image"|"video", thumbnail_url?}] — replaces `media_urls`

  content Content @relation(fields: [content_id], references: [id], onDelete: Cascade)
}
```

- `text_excerpt`: derived server-side from `content_json` on create/update
  (plain-text walk of the doc, truncated). Used anywhere a plain string is
  needed — notification bodies, a future search index — without re-parsing
  the rich doc. Not shown directly in the UI (the UI always renders
  `content_json` via read-only Tiptap).
- `media` replaces `media_urls`. Every item now carries its own `type` so
  the carousel renderer knows whether to render an `<img>` or a `<video>`.
- Purely additive/replacing migration — no real `post`-type content exists
  in the DB yet (confirmed empty as of Phase 5's verification pass), so this
  is a straightforward column swap, not a backfill.

Backend `content.schemas.ts`/`content.service.ts` (post branch only):
- `createContentSchema`'s post branch: `content_json` (validated as a
  plausible Tiptap doc shape — top-level `{type: "doc", content: [...]}`
  via `z.object({type: z.literal("doc"), content: z.array(z.any())})`,
  with the serialized JSON string capped at 20,000 bytes — same order of
  magnitude as today's 2,000-char plain-text cap, generous for formatting
  overhead) + `media` (array of `{url: string().url(), type:
  enum(["image","video"]), thumbnail_url?: string().url()}`, max 10)
  replace `text`/`media_urls`.
- `flattenContent`'s post-detail spread naturally carries `content_json`/
  `media`/`text_excerpt` through unchanged — no service-layer logic needed
  beyond the schema/field rename, since post creation is a straight
  pass-through into `PostDetail`.
- Server derives `text_excerpt` in `createContent`/`updateContent`'s post
  branch via a small shared `extractPlainText(doc: TiptapJSON): string`
  helper (walk `content_json`, concatenate text nodes, truncate ~280
  chars) — lives in `backend/src/utils/` since nothing else needs it yet.

## Frontend changes

**Models** (`frontend/src/models/post.model.ts`) — this is new feature work,
not a refactor-preserving-shape task like Phase 5, so the shape genuinely
changes:
```ts
export interface PostMedia { url: string; type: "image" | "video"; thumbnail_url?: string }
export interface Post {
  // ...unchanged fields (id, author_id, author, type, sport, tags, like_count, comment_count, created_at)
  content_json: JSONContent; // Tiptap's own type, from @tiptap/react
  media: PostMedia[];        // replaces media_urls
}
export interface CreatePostRequest { type: "log" | "post"; content_json: JSONContent; media?: PostMedia[]; sport?: string; tags?: string[] }
```

**`PostComposer`** (new, `frontend/src/modules/feed/components/PostComposer.tsx`):
- Tiptap editor instance (`useEditor` with StarterKit), small toolbar above
  it: Bold / Italic / Bullet list / Numbered list / Link buttons, each
  calling the corresponding `editor.chain().focus().toggleX().run()`.
- Below the editor: a media strip. "Add photo" / "Add video" buttons open
  native multi-select file inputs (`accept="image/*"` /
  `accept="video/*"`); each selected file goes through `useUpload` with
  `context: "post"` or `context: "reel"` respectively. Each item in the
  strip shows a thumbnail, an upload progress bar while in flight, and a
  remove (×) button. Uses the same visual language as the existing
  `ImageUpload`/`VideoUpload` components rather than introducing new
  patterns.
- Post button disabled while `editor` is empty (no text and no media) or
  while any upload is still in flight.
- Replaces the plain `<textarea>` block in `Feed.tsx`'s composer card
  (the "Update"/"Training log" tab toggle above it is unchanged).

**Post card rendering** (`Feed.tsx`'s `PostCard`, `ProfileFeedTab.tsx`'s
post branch):
- `<p>{p.text}</p>` → a read-only `EditorContent` (`useEditor({editable:
  false, content: p.content_json, extensions: [StarterKit]})`).
- Single `<img src={media_urls[0]}>` → a horizontal-scroll media carousel
  component (new, small — `frontend/src/modules/feed/components/
  MediaCarousel.tsx`) mapping `p.media`, rendering `<img>` or `<video
  controls>` per item's `type`.

**Navigation** (`Layout.tsx`):
- Sidebar "Home" nav item: `to: "/dashboard"` → `to: "/feed"`.
- Header logo `<Link to="/dashboard">` → `to="/feed"`.
- Profile dropdown: new entry above "View profile" —
  `<NavLink to="/dashboard">` with a dashboard-style icon, label "My
  Dashboard".
- `Login.tsx`: both `<Navigate to="/dashboard">` (already-logged-in guard)
  and the post-submit `navigate("/dashboard", {replace: true})` become
  `/feed`.
- Grep for any other hardcoded `/dashboard` redirect (e.g. signup success,
  email verification success) and repoint those too, so there's exactly one
  post-login destination.

## What's explicitly out of scope

- No changes to `type: "log"` vs `"post"` semantics (Training log tab) —
  same distinction, just richer content underneath.
- No changes to Blogs/Reels rendering or their own composers — this is
  post-type only.
- No mid-doc emoji picker, @mentions, or hashtag autocomplete — plain
  StarterKit formatting only, for this pass.
- No edit-history/version tracking on rich content — `updateContent`'s post
  branch just overwrites `content_json`/`media`/`text_excerpt` same as
  today's plain-field overwrite.

## Testing

- `cd backend && npm run typecheck`, `cd frontend && npm run typecheck &&
  npm run build` — zero errors.
- Manual browser pass (per CLAUDE.md's UI-verification rule): compose a
  post with bold text + a bullet list + 2 images + 1 video, confirm it
  renders correctly in Feed and in Profile's activity tab; confirm
  post-login redirect lands on `/feed`; confirm "My Dashboard" in the
  profile dropdown opens the untouched stats page.
