import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useAuthStore } from "../store/auth";
import { queryKeys } from "./queryKeys";

interface ContentItemLike {
  id: string;
  like_count?: number;
  comment_count?: number;
}

function patchContentField(qc: QueryClient, contentId: string, field: "like_count" | "comment_count", value: number) {
  const patchItem = (item: ContentItemLike) => (item.id === contentId ? { ...item, [field]: value } : item);

  // Catch feed — infinite query of { pages: [{ data: ContentItem[] }] }
  qc.setQueriesData<{ pages: { data: ContentItemLike[]; nextCursor: string | null }[] } | undefined>(
    { queryKey: queryKeys.feedInfinite() },
    (old) => {
      if (!old?.pages) return old;
      return { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map(patchItem) })) };
    }
  );

  // Profile activity feed — plain ContentItem[], one cache per profile viewed
  qc.setQueriesData<ContentItemLike[] | undefined>(
    { queryKey: ["author-content"] },
    (old) => (Array.isArray(old) ? old.map(patchItem) : old)
  );
}

/**
 * App-wide real-time sync for content (post/blog/reel) likes, comments, and
 * comment-likes — patches React Query caches in place as socket events
 * arrive so open feeds/profiles/comment threads update live for every
 * connected viewer, not just the acting user. Owns the socket connection
 * lifecycle (connect while authenticated, disconnect on logout) — mount
 * once, high in the tree (Layout), same pattern Messages.tsx already used
 * for message real-time before this.
 */
export function useContentRealtime() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const socket = connectSocket(accessToken);

    const onContentLike = (payload: { contentId: string; like_count: number }) => {
      patchContentField(qc, payload.contentId, "like_count", payload.like_count);
    };

    const onCommentAdded = (payload: { contentId: string; comment: { id: string }; comment_count: number }) => {
      patchContentField(qc, payload.contentId, "comment_count", payload.comment_count);
      qc.setQueriesData<{ data: unknown[] } | undefined>(
        { predicate: (q) => q.queryKey[0] === "comments" && q.queryKey[2] === payload.contentId },
        (old) => {
          if (!old?.data) return old;
          if (old.data.some((c: any) => c.id === payload.comment.id)) return old;
          return { ...old, data: [...old.data, payload.comment] };
        }
      );
    };

    const onCommentLike = (payload: { contentId: string; commentId: string; like_count: number }) => {
      qc.setQueriesData<{ data: { id: string; like_count: number }[] } | undefined>(
        { predicate: (q) => q.queryKey[0] === "comments" && q.queryKey[2] === payload.contentId },
        (old) => {
          if (!old?.data) return old;
          return { ...old, data: old.data.map((c) => (c.id === payload.commentId ? { ...c, like_count: payload.like_count } : c)) };
        }
      );
    };

    socket.on("content_like_changed", onContentLike);
    socket.on("comment_added", onCommentAdded);
    socket.on("comment_like_changed", onCommentLike);

    return () => {
      socket.off("content_like_changed", onContentLike);
      socket.off("comment_added", onCommentAdded);
      socket.off("comment_like_changed", onCommentLike);
    };
  }, [accessToken, qc]);

  useEffect(() => {
    if (!accessToken) disconnectSocket();
  }, [accessToken]);
}
