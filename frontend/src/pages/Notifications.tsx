import { useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../hooks";
import { PageHeader, Spinner } from "../components/UI";
import { BackButton } from "../components/BackButton";
import type { Notification } from "../models";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getDateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  if (itemDay >= today) return "Today";
  if (itemDay >= yesterday) return "Yesterday";
  if (itemDay >= weekAgo) return "This Week";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Earlier"];

function ActorAvatar({ actor, type }: {
  actor?: Notification["actor"];
  type: string;
}) {
  if (actor?.profile_photo_url) {
    return (
      <img
        src={actor.profile_photo_url}
        alt={actor.full_name}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-hair"
      />
    );
  }

  const initials = actor?.full_name
    ? actor.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const colorMap: Record<string, string> = {
    new_application: "bg-brand-100 text-brand-600",
    application_shortlisted: "bg-blue-100 text-blue-600",
    application_selected: "bg-green-100 text-green-600",
    application_rejected: "bg-red-100 text-red-600",
    new_message: "bg-ink-100 text-ink-600",
    new_follower: "bg-purple-100 text-purple-600",
    post_liked: "bg-pink-100 text-pink-600",
    verification_approved: "bg-green-100 text-green-600",
    verification_rejected: "bg-red-100 text-red-600",
  };

  const color = colorMap[type] ?? "bg-fill text-ink-70";

  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 border border-hair ${color}`}>
      {initials}
    </div>
  );
}

function NotificationItem({
  n,
  onTap,
}: {
  n: Notification;
  onTap: (n: Notification) => void;
}) {
  return (
    <button
      onClick={() => onTap(n)}
      className={`w-full flex gap-3 px-4 py-3.5 text-left transition hover:bg-fill/60 min-h-[64px] items-start relative
        ${!n.read ? "border-l-2 border-brand-500 bg-fill/30" : "border-l-2 border-transparent"}`}
    >
      <ActorAvatar actor={n.actor} type={n.type} />
      <div className="flex-1 min-w-0">
        <div className={`text-[13.5px] leading-snug ${!n.read ? "font-semibold text-ink" : "font-medium text-ink-70"}`}>
          {n.title}
        </div>
        {n.body && (
          <div className="text-sm text-ink-sub mt-0.5 leading-snug line-clamp-2">{n.body}</div>
        )}
        <div className="text-[11px] text-ink-faint mt-1 font-mononum">{relativeTime(n.created_at)}</div>
      </div>
      {!n.read && (
        <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
      )}
    </button>
  );
}

export default function Notifications() {
  const navigate = useNavigate();
  const { list, markAllRead, markOneRead } = useNotifications();

  const allItems: Notification[] = list.data?.pages.flatMap((p) => p.data) ?? [];
  const unreadCount = allItems.filter((n) => !n.read).length;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && list.hasNextPage && !list.isFetchingNextPage) {
          list.fetchNextPage();
        }
      });
      observerRef.current.observe(node);
    },
    [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage]
  );

  const handleTap = (n: Notification) => {
    if (!n.read) markOneRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  // Group notifications
  const groups = new Map<string, Notification[]>();
  for (const n of allItems) {
    const group = getDateGroup(n.created_at);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(n);
  }

  const orderedGroups = GROUP_ORDER.filter((g) => groups.has(g)).map((g) => ({
    label: g,
    items: groups.get(g)!,
  }));

  return (
    <div className="max-w-2xl w-full mx-auto">
      <BackButton className="px-4 sm:px-0 pt-2" />
      <div className="flex items-center justify-between px-4 py-4 sm:px-0">
        <PageHeader title="Notifications" subtitle="Activity" />
        {unreadCount > 0 && (
          <button
            className="btn-ghost text-sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            Mark all read
          </button>
        )}
      </div>

      {list.isLoading ? (
        <div className="panel p-8 flex justify-center">
          <Spinner className="text-brand-500" />
        </div>
      ) : allItems.length === 0 ? (
        <div className="panel p-10 text-center">
          <div className="font-disp text-xl text-ink-70">All caught up</div>
          <p className="text-sm text-ink-sub mt-2">
            No notifications yet. Activity from the network will appear here.
          </p>
        </div>
      ) : (
        <div className="panel divide-y divide-hairsoft overflow-hidden">
          {orderedGroups.map(({ label, items }) => (
            <div key={label}>
              <div className="px-4 py-2 bg-fill/50 border-b border-hairsoft">
                <span className="text-[11px] font-mononum uppercase tracking-[0.08em] text-ink-sub">
                  {label}
                </span>
              </div>
              {items.map((n) => (
                <NotificationItem key={n.id} n={n} onTap={handleTap} />
              ))}
            </div>
          ))}

          {list.hasNextPage && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {list.isFetchingNextPage && <Spinner className="text-brand-500" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
