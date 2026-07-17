import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, humanizeError } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { Badge, Placeholder } from "../../../components/UI";
import type { ContentItem, FeedItem, UpdatePostRequest } from "../../../models";
import { toFeedItem } from "../../../models";
import { Heart, MessageCircle, Play, Pencil, Eye, EyeOff, Trash2 } from "lucide-react";
import { PostContentView } from "../../feed/components/PostContentView";
import { MediaCarousel } from "../../feed/components/MediaCarousel";
import { PostComposer } from "../../feed/components/PostComposer";
import { postService, reelService } from "../../../services";
import type { UpdateReelRequest } from "../../reels/services/reel.service";
import { formatDate } from "../../../utils/date";

// Unified, chronological "Feed" tab on the profile page — merges this user's
// Posts, Blogs and Reels into one Instagram/LinkedIn-style activity stream.
// The backend already returns them pre-merged/ordered from one Content query
// (content_type discriminates which shape each row is); this only splits them
// back out for display.

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return formatDate(ms);
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

function ActionsRow({
  hidden,
  onEdit,
  onToggleHidden,
  onDelete,
}: {
  hidden?: boolean;
  onEdit: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 ml-auto">
      {hidden && <Badge color="slate">Hidden</Badge>}
      <button
        onClick={onEdit}
        className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-ink-faint hover:text-ink hover:bg-fill"
        aria-label="Edit"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onToggleHidden}
        className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-ink-faint hover:text-ink hover:bg-fill"
        aria-label={hidden ? "Unhide" : "Hide"}
      >
        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-ink-faint hover:text-red-600 hover:bg-red-50"
        aria-label="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function DeleteConfirm({ pending, onConfirm, onCancel }: { pending: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="card card-body">
      <div className="flex items-center gap-3 rounded bg-red-50 border border-red-200 p-3">
        <span className="flex-1 text-sm text-red-900">Delete this?</span>
        <button onClick={onConfirm} disabled={pending} className="btn-danger min-h-[44px]">Confirm</button>
        <button onClick={onCancel} className="btn-secondary min-h-[44px]">Cancel</button>
      </div>
    </div>
  );
}

export function ProfileFeedTab({ userId, isOwner = false }: { userId: string; isOwner?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingReelId, setEditingReelId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [reelForm, setReelForm] = useState({ title: "", description: "", sport: "" });
  const [reelErr, setReelErr] = useState<string | null>(null);

  const contentQ = useQuery({
    queryKey: queryKeys.authorContent(userId),
    queryFn: async () => (await api.get<{ items: ContentItem[] }>("/content", { params: { author_id: userId, limit: 20 } })).data.items,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.authorContent(userId) });
    qc.invalidateQueries({ queryKey: queryKeys.feedInfinite() });
  };

  const updatePost = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdatePostRequest) => postService.update(id, data),
    onSuccess: () => { invalidate(); setEditingPostId(null); },
  });

  const updateReel = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateReelRequest) => reelService.update(id, data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.reels() });
      setEditingReelId(null);
    },
    onError: (e) => setReelErr(humanizeError(e)),
  });

  const deleteContent = useMutation({
    mutationFn: (id: string) => api.delete(`/content/${id}`),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: queryKeys.reels() }); setPendingDeleteId(null); },
  });

  const toggleHidden = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.patch(`/content/${id}/hidden`, { hidden }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: queryKeys.reels() }); },
  });

  function startEditReel(r: { id: string; title?: string; caption?: string; description?: string; sport?: string }) {
    setReelForm({ title: r.title ?? r.caption ?? "", description: r.description ?? "", sport: r.sport ?? "" });
    setReelErr(null);
    setEditingReelId(r.id);
  }

  if (contentQ.isLoading) {
    return (
      <div className="space-y-3">
        <div className="skel h-28 rounded" />
        <div className="skel h-28 rounded" />
      </div>
    );
  }

  const items: FeedItem[] = (contentQ.data ?? []).map(toFeedItem);

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
        if (pendingDeleteId === item.data.id) {
          return (
            <DeleteConfirm
              key={`del-${item.data.id}`}
              pending={deleteContent.isPending}
              onConfirm={() => deleteContent.mutate(item.data.id)}
              onCancel={() => setPendingDeleteId(null)}
            />
          );
        }

        if (item.kind === "post") {
          const p = item.data;

          if (editingPostId === p.id) {
            return (
              <div key={`post-${p.id}`} className="card card-body">
                <p className="text-sm font-semibold text-ink mb-2">Edit post</p>
                <PostComposer
                  initialContentJson={p.content_json}
                  initialMedia={p.media}
                  submitting={updatePost.isPending}
                  submitLabel="Save"
                  onSubmit={(data) => updatePost.mutate({ id: p.id, content_json: data.content_json, media: data.media })}
                  onCancel={() => setEditingPostId(null)}
                />
              </div>
            );
          }

          return (
            <div key={`post-${p.id}`} className="card card-body">
              <div className="flex items-center">
                <Badge color="blue">Post</Badge>
                {isOwner && (
                  <ActionsRow
                    hidden={p.hidden}
                    onEdit={() => setEditingPostId(p.id)}
                    onToggleHidden={() => toggleHidden.mutate({ id: p.id, hidden: !p.hidden })}
                    onDelete={() => setPendingDeleteId(p.id)}
                  />
                )}
              </div>
              <div className="mt-2.5">
                <PostContentView content={p.content_json} />
              </div>
              <MediaCarousel media={p.media} />
              <CountsRow likes={p.like_count} comments={p.comment_count} at={item.at} />
            </div>
          );
        }
        if (item.kind === "blog") {
          const b = item.data;
          return (
            <div key={`blog-${b.id}`} className="card card-body">
              <div className="flex items-center">
                <Badge color="amber">Blog</Badge>
                {isOwner && (
                  <ActionsRow
                    hidden={b.hidden}
                    onEdit={() => navigate(`/blogs/${b.id}/edit`)}
                    onToggleHidden={() => toggleHidden.mutate({ id: b.id, hidden: !b.hidden })}
                    onDelete={() => setPendingDeleteId(b.id)}
                  />
                )}
              </div>
              <Link to={`/blogs/${b.id}`} className="block mt-2.5 -m-0.5 p-0.5 transition hover:opacity-80">
                <div className="flex gap-3">
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
              </Link>
              <CountsRow likes={b.like_count} comments={b.comment_count} at={item.at} />
            </div>
          );
        }
        const r = item.data;

        if (editingReelId === r.id) {
          return (
            <div key={`reel-${r.id}`} className="card card-body space-y-3">
              <p className="text-sm font-semibold text-ink mb-1">Edit video</p>
              <label className="block">
                <span className="label">Title</span>
                <input
                  className="input min-h-[44px]"
                  maxLength={100}
                  value={reelForm.title}
                  onChange={(e) => setReelForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="label">Description</span>
                <textarea
                  className="input min-h-[80px] resize-none"
                  maxLength={500}
                  value={reelForm.description}
                  onChange={(e) => setReelForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="label">Sport</span>
                <input
                  className="input min-h-[44px]"
                  value={reelForm.sport}
                  onChange={(e) => setReelForm((f) => ({ ...f, sport: e.target.value }))}
                />
              </label>
              {reelErr && <p className="text-sm text-red-600">{reelErr}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 min-h-[44px]" onClick={() => setEditingReelId(null)}>Cancel</button>
                <button
                  className="btn-primary flex-1 min-h-[44px]"
                  disabled={updateReel.isPending || !reelForm.title.trim()}
                  onClick={() => updateReel.mutate({ id: r.id, ...reelForm })}
                >
                  {updateReel.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          );
        }

        return (
          <div key={`reel-${r.id}`} className="card card-body">
            <div className="flex items-center">
              <Badge color="emerald">Reel</Badge>
              {isOwner && (
                <ActionsRow
                  hidden={r.hidden}
                  onEdit={() => startEditReel(r)}
                  onToggleHidden={() => toggleHidden.mutate({ id: r.id, hidden: !r.hidden })}
                  onDelete={() => setPendingDeleteId(r.id)}
                />
              )}
            </div>
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
