import type { Post } from "./post.model";
import type { Blog } from "./blog.model";
import type { Reel } from "./reel.model";

/** A row from the unified `/content` endpoint, discriminated by content_type. */
export type ContentItem = (Post | Blog | Reel) & { content_type: "post" | "blog" | "reel" };

export type FeedItem =
  | { kind: "post"; at: number; data: Post }
  | { kind: "blog"; at: number; data: Blog }
  | { kind: "reel"; at: number; data: Reel };

export function timeOf(v: string | number): number {
  return typeof v === "number" ? v : new Date(v).getTime();
}

export function toFeedItem(c: ContentItem): FeedItem {
  const at = timeOf(c.created_at);
  if (c.content_type === "blog") return { kind: "blog", at, data: c as Blog };
  if (c.content_type === "reel") return { kind: "reel", at, data: c as Reel };
  return { kind: "post", at, data: c as Post };
}
