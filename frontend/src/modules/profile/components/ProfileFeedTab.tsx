import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { Badge, Placeholder } from "../../../components/UI";
import type { Post, Blog, Reel } from "../../../models";
import { Heart, MessageCircle, Play } from "lucide-react";

// Unified, chronological "Feed" tab on the profile page — merges this user's
// Posts, Blogs and Reels into one Instagram/LinkedIn-style activity stream.
// Each item still lives in its own table/module; this only merges them for display.
type FeedItem =
  | { kind: "post"; at: number; data: Post }
  | { kind: "blog"; at: number; data: Blog }
  | { kind: "reel"; at: number; data: Reel };

function timeOf(v: string | number): number {
  return typeof v === "number" ? v : new Date(v).getTime();
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(ms).toLocaleDateString();
}

function CountsRow({ likes, comments, at }: { likes: number; comments: number; at: number }) {
  return (
    <div className="mt-3 flex items-center justify-between text-ink-faint">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1 text-[12px]"><Heart className="h-3.5 w-3.5" /> {likes}</span>
        <span className="flex items-center gap-1 text-[12px]"><MessageCircle className="h-3.5 w-3.5" /> {comments}</span>
      </div>
      <span className="font-mononum text-[10.5px]">{relativeTime(at)}</span>
    </div>
  );
}

export function ProfileFeedTab({ userId }: { userId: string }) {
  const postsQ = useQuery({
    queryKey: queryKeys.userPosts(userId),
    queryFn: async () => (await api.get<{ items: Post[] }>("/posts", { params: { author_id: userId, limit: 20 } })).data.items,
  });
  const blogsQ = useQuery({
    queryKey: ["profile-feed-blogs", userId],
    queryFn: async () => (await api.get<{ items: Blog[] }>("/blogs", { params: { author_id: userId, limit: 20 } })).data.items,
  });
  const reelsQ = useQuery({
    queryKey: queryKeys.userReels(userId),
    queryFn: async () => (await api.get<{ items: Reel[] }>("/reels", { params: { author_id: userId, limit: 20 } })).data.items,
  });

  if (postsQ.isLoading || blogsQ.isLoading || reelsQ.isLoading) {
    return (
      <div className="space-y-3">
        <div className="skel h-28 rounded" />
        <div className="skel h-28 rounded" />
      </div>
    );
  }

  const items: FeedItem[] = [
    ...(postsQ.data ?? []).map((p): FeedItem => ({ kind: "post", at: timeOf(p.created_at), data: p })),
    ...(blogsQ.data ?? []).map((b): FeedItem => ({ kind: "blog", at: timeOf(b.created_at), data: b })),
    ...(reelsQ.data ?? []).map((r): FeedItem => ({ kind: "reel", at: timeOf(r.created_at), data: r })),
  ].sort((a, b) => b.at - a.at);

  if (items.length === 0) {
    return (
      <div className="card card-body text-center border-dashed">
        <div className="lab text-ink-faint">No activity yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
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
        if (item.kind === "blog") {
          const b = item.data;
          return (
            <Link key={`blog-${b.id}`} to={`/blogs/${b.slug}`} className="card card-body block transition hover:shadow-pop">
              <Badge color="amber">Blog</Badge>
              <div className="mt-2.5 flex gap-3">
                {b.cover_image_url ? (
                  <img src={b.cover_image_url} alt="" className="h-16 w-16 rounded object-cover flex-shrink-0" />
                ) : (
                  <Placeholder height={64} className="w-16 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-disp text-[16px] leading-tight truncate">{b.title}</div>
                  <p className="mt-1 text-[12.5px] text-ink-sub line-clamp-2">{b.excerpt}</p>
                </div>
              </div>
              <CountsRow likes={b.like_count} comments={b.comment_count} at={item.at} />
            </Link>
          );
        }
        const r = item.data;
        return (
          <div key={`reel-${r.id}`} className="card card-body">
            <Badge color="emerald">Reel</Badge>
            <div className="mt-2.5 flex gap-3">
              <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded bg-ink">
                {r.thumbnail_url ? (
                  <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Placeholder height={80} />
                )}
                <span className="absolute inset-0 flex items-center justify-center text-white/80">
                  <Play className="h-5 w-5" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-ink-70 line-clamp-3">{r.caption || r.title || "Reel"}</p>
              </div>
            </div>
            <CountsRow likes={r.like_count} comments={r.comment_count} at={item.at} />
          </div>
        );
      })}
    </div>
  );
}
