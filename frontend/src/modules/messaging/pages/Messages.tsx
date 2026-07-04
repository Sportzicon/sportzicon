import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messageService, userService, searchService } from "../../../services";
import { useAuthStore } from "../../../store/auth";
import { PageHeader, Spinner, Avatar, EmptyState } from "../../../components/UI";
import { MobileDrawer } from "../../../components/MobileDrawer";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { queryKeys } from "../../../hooks/queryKeys";
import { Send, Plus, Search, ArrowLeft, X } from "lucide-react";
import type { Conversation, Message } from "../../../models";
import { connectSocket, disconnectSocket } from "../../../lib/socket";

// ── helpers ────────────────────────────────────────────────────────────────────

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function groupByDate(messages: Message[]): Array<{ date: string; messages: Message[] }> {
  const groups: Array<{ date: string; messages: Message[] }> = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
  }
  return groups;
}

// ── New conversation contact picker ───────────────────────────────────────────

interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (userId: string, name: string, avatar: string | null) => void;
}

function ContactPicker({ isOpen, onClose, onSelect }: ContactPickerProps) {
  const [q, setQ] = useState("");
  const debouncedQ = useRef(q);

  useEffect(() => {
    const t = setTimeout(() => { debouncedQ.current = q; }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({
    queryKey: queryKeys.search("users", { q }),
    queryFn: () => searchService.searchUsers({ q, limit: 20 }),
    enabled: q.length >= 2,
  });

  const players = (results.data?.data ?? []) as Array<{ id: string; full_name: string; profile_photo_url?: string | null; role?: string }>;

  return (
    <MobileDrawer isOpen={isOpen} onClose={onClose} title="New Message">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-sub" />
          <input
            autoFocus
            type="search"
            className="input pl-9 w-full min-h-[44px]"
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {results.isLoading && <div className="flex justify-center py-4"><Spinner /></div>}
        {!results.isLoading && q.length >= 2 && players.length === 0 && (
          <p className="text-sm text-ink-sub text-center py-4">No users found for "{q}"</p>
        )}
        {players.length > 0 && (
          <ul className="space-y-1">
            {players.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => { onSelect(p.id, p.full_name, p.profile_photo_url ?? null); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-fill transition min-h-[44px] text-left"
                >
                  <Avatar name={p.full_name} src={p.profile_photo_url ?? undefined} size={40} square={false} />
                  <div>
                    <div className="text-sm font-semibold text-ink">{p.full_name}</div>
                    {p.role && <div className="lab text-[10.5px] capitalize">{p.role}</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.length < 2 && (
          <p className="text-sm text-ink-sub text-center py-6">Type at least 2 characters to search</p>
        )}
      </div>
    </MobileDrawer>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Messages() {
  const me = useAuthStore((s) => s.user)!;
  const [params, setParams] = useSearchParams();
  const initialTo = params.get("to") ?? "";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [recipientId, setRecipientId] = useState<string | null>(initialTo || null);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [recipientAvatar, setRecipientAvatar] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "thread">(initialTo ? "thread" : "list");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  // Handle ?to= URL param
  useEffect(() => {
    const to = params.get("to");
    if (to && to !== recipientId) {
      setActiveId(null);
      setRecipientId(to);
      setMobileView("thread");
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const convs = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messageService.getConversations(),
    refetchInterval: 30_000,
  });

  // Match recipient to existing conversation
  useEffect(() => {
    if (!convs.data || !recipientId) return;
    const existing = convs.data.find((c: Conversation) => c.participant_ids.includes(recipientId));
    if (existing && activeId !== existing.id) setActiveId(existing.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.data, recipientId]);

  // Load recipient profile when starting a new conversation
  const recipientProfile = useQuery({
    queryKey: queryKeys.user(recipientId ?? ""),
    queryFn: () => userService.get(recipientId!),
    enabled: !!recipientId && !activeId,
  });

  // Fetch messages for active conversation
  const messages = useQuery({
    queryKey: queryKeys.messages(activeId ?? ""),
    queryFn: () => messageService.getMessages(activeId!),
    enabled: !!activeId,
    select: (data) => data.items,
  });

  // WebSocket — connect once, join/leave conversation rooms
  useEffect(() => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const socket = connectSocket(token);

    socket.on("new_message", (msg: Message) => {
      const convId = msg.conversation_id;
      // Append to message cache if this conversation is loaded
      qc.setQueryData<{ items: Message[]; next_cursor: string | null }>(
        queryKeys.messages(convId),
        (old) => old ? { ...old, items: [...old.items, msg] } : old
      );
      // Refresh conversation list (last message preview + unread count)
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      qc.invalidateQueries({ queryKey: queryKeys.notifCount() });
    });

    return () => {
      socket.off("new_message");
      disconnectSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Join/leave conversation rooms as active conversation changes
  useEffect(() => {
    if (!activeId) return;
    const socket = connectSocket(useAuthStore.getState().accessToken ?? "");
    socket.emit("join", [activeId]);
    return () => { socket.emit("leave", activeId); };
  }, [activeId]);

  // Also join all loaded conversation rooms for unread notifications
  useEffect(() => {
    if (!convs.data?.length) return;
    const socket = connectSocket(useAuthStore.getState().accessToken ?? "");
    const ids = convs.data.map((c: Conversation) => c.id);
    socket.emit("join", ids);
  }, [convs.data]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;
  }, [messages.data?.length, activeId]);

  // Mark read once when entering a conversation thread
  useEffect(() => {
    if (activeId) {
      messageService.markRead(activeId)
        .then(() => {
          qc.invalidateQueries({ queryKey: queryKeys.conversations() });
          qc.invalidateQueries({ queryKey: queryKeys.notifCount() });
        })
        .catch(() => undefined);
    }
  }, [activeId, qc]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !recipientId || sending) return;
    setSending(true);
    try {
      const result = await messageService.send({ recipient_id: recipientId, body: text });
      setText("");
      setActiveId(result.conversation_id);
      qc.invalidateQueries({ queryKey: queryKeys.messages(result.conversation_id) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); send(); }
  }

  function pickConversation(c: Conversation) {
    const otherId = c.participant_ids.find((p) => p !== me.id);
    setActiveId(c.id);
    setRecipientId(otherId ?? null);
    setRecipientName(c._other_name ?? null);
    setRecipientAvatar(c._other_avatar ?? null);
    setParams({});
    setMobileView("thread");
    // Optimistically zero the unread badge so it clears instantly
    qc.setQueryData<Conversation[]>(queryKeys.conversations(), (old) =>
      old?.map((conv) =>
        conv.id === c.id
          ? { ...conv, _unread_count: 0, unread_counts: conv.unread_counts ? { ...conv.unread_counts, [me.id]: 0 } : undefined }
          : conv
      )
    );
  }

  function handleContactSelected(userId: string, name: string, avatar: string | null) {
    setRecipientId(userId);
    setRecipientName(name);
    setRecipientAvatar(avatar);
    setActiveId(null);
    setMobileView("thread");
  }

  const displayConvs: Conversation[] = convs.data ?? [];
  const displayMessages: Message[] = messages.data ?? [];

  const activeConv = displayConvs.find((c) => c.id === activeId);
  const activeOtherId = activeConv?.participant_ids?.find((p) => p !== me.id);

  const displayName =
    recipientName ??
    (activeConv as Conversation)?._other_name ??
    recipientProfile.data?.full_name ??
    recipientId?.slice(0, 16) ??
    "New conversation";

  const displayAvatar =
    recipientAvatar ??
    (activeConv as Conversation)?._other_avatar ??
    (recipientProfile.data?.profile_photo_url ?? null);

  const messageGroups = groupByDate(displayMessages);

  return (
    <div className="space-y-0 h-full">
      <PageHeader
        title="Messages"
        subtitle="Inbox"
        sticky
      />

      <ContactPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleContactSelected}
      />

      <div className="panel overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 420 }}>
        <div className="grid h-full sm:grid-cols-[320px_1fr] sm:divide-x sm:divide-hair">

          {/* ── Conversation list ──────────────────────────────────────────── */}
          <ErrorBoundary>
          <aside className={`${mobileView === "thread" ? "hidden sm:flex" : "flex"} flex-col overflow-hidden`}>
            <div className="px-[18px] py-[18px] border-b border-hair flex items-center justify-between">
              <div>
                <div className="kicker">Inbox</div>
                <h2 className="font-disp text-2xl mt-1.5">Messages</h2>
              </div>
              <button
                onClick={() => setPickerOpen(true)}
                className="sm:hidden p-2.5 rounded-lg hover:bg-fill transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="New message"
              >
                <Plus className="h-5 w-5 text-ink" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 flex flex-col">
              {convs.isLoading ? (
                <div className="p-6 flex justify-center"><Spinner className="text-brand-500" /></div>
              ) : displayConvs.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No conversations yet"
                    hint="Start a conversation with an athlete, club or scout."
                    action={<Link to="/search" className="btn-primary text-[13px]">Find a user →</Link>}
                  />
                </div>
              ) : (
                <>
                  <ul className="flex-1">
                    {displayConvs.map((c) => {
                      const unread = c._unread_count ?? (c.unread_counts?.[me.id] ?? 0);
                      const isActive = activeId === c.id;
                      const lastMsgTs = (c.last_message as { created_at?: string; at?: string } | undefined)?.created_at
                        ?? (c.last_message as { created_at?: string; at?: string } | undefined)?.at
                        ?? c.updated_at;
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => pickConversation(c)}
                            className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-hairsoft transition min-h-[64px]"
                            style={{
                              background: isActive ? "#F2F1EC" : "transparent",
                              borderLeft: `2px solid ${isActive ? "#FA4D14" : "transparent"}`
                            }}
                          >
                            <Avatar
                              name={c._other_name ?? "?"}
                              src={c._other_avatar}
                              size={44}
                              square={false}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[13.5px] font-semibold text-ink truncate">{c._other_name ?? "Unknown"}</span>
                                <span className="lab flex-shrink-0 text-[10.5px]">
                                  {lastMsgTs ? timeAgo(lastMsgTs) : ""}
                                </span>
                              </div>
                              {c._other_sub && <div className="lab text-[10.5px] mt-0.5 capitalize">{c._other_sub}</div>}
                              <div className="text-[12.5px] text-ink-sub truncate mt-1 leading-snug">
                                {(c.last_message as { body?: string } | undefined)?.body ?? "—"}
                              </div>
                            </div>
                            {!!unread && (
                              <span className="font-mononum text-[9px] min-w-[18px] h-[18px] rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 mt-1 px-1">
                                {unread > 99 ? "99+" : unread}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </aside>
          </ErrorBoundary>

          {/* ── Message thread ─────────────────────────────────────────────── */}
          <ErrorBoundary>
          <section className={`${mobileView === "list" ? "hidden sm:flex" : "flex"} flex-col overflow-hidden min-w-0`}>
            {(activeConv || recipientId) ? (
              <div className="px-3 sm:px-[22px] py-3.5 border-b border-hair bg-panel flex items-center gap-3 flex-shrink-0">
                <button
                  className="sm:hidden -ml-1 mr-1 p-2.5 rounded min-h-[44px] min-w-[44px] flex items-center justify-center text-ink-70 hover:bg-fill transition flex-shrink-0"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar
                  name={displayName}
                  src={displayAvatar}
                  size={40}
                  square={false}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14.5px] font-semibold text-ink truncate">{displayName}</div>
                  {(activeConv as Conversation)?._other_sub && (
                    <div className="lab text-[10.5px] mt-0.5 capitalize">{(activeConv as Conversation)._other_sub}</div>
                  )}
                  {!activeConv && recipientId && (
                    <div className="lab text-[10.5px] mt-0.5">New conversation</div>
                  )}
                </div>
                {(recipientId || activeOtherId) && (
                  <Link to={`/profile/${recipientId ?? activeOtherId}`} className="btn-ghost text-[12px] flex-shrink-0">
                    View profile →
                  </Link>
                )}
              </div>
            ) : (
              <div className="px-[22px] py-3.5 border-b border-hair bg-panel">
                <div className="lab">Select a conversation or start a new one</div>
              </div>
            )}

            {/* Messages area */}
            <div ref={endRef} className="flex-1 overflow-y-auto px-3 sm:px-[22px] py-6 flex flex-col gap-1 bg-fill/30">
              {messages.isLoading ? (
                <div className="flex justify-center pt-8"><Spinner className="text-brand-500" /></div>
              ) : messageGroups.length ? (
                messageGroups.map((group) => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-hair" />
                      <span className="lab text-[10.5px] text-ink-faint px-2">{group.date}</span>
                      <div className="flex-1 h-px bg-hair" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {group.messages.map((m) => {
                        const isMe = m.sender_id === me.id;
                        return (
                          <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}>
                            {!isMe && (
                              <Avatar
                                name={displayName}
                                src={displayAvatar}
                                size={28}
                                square={false}
                                className="mb-1 flex-shrink-0"
                              />
                            )}
                            <div className="max-w-[72%] sm:max-w-[62%]">
                              <div
                                className={`px-[14px] py-[10px] text-[13.5px] leading-snug ${
                                  isMe
                                    ? "bg-brand-500 text-white rounded-[10px] rounded-br-[2px]"
                                    : "bg-panel text-ink border border-hair rounded-[10px] rounded-bl-[2px]"
                                }`}
                              >
                                {m.body}
                              </div>
                              <div className={`lab mt-1 text-[10.5px] ${isMe ? "text-right" : "text-left"}`}>
                                {timeAgo(m.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-sm text-ink-sub pt-12">
                  {activeId
                    ? "No messages yet. Say hello!"
                    : recipientId
                    ? `Start your conversation with ${displayName}.`
                    : "Pick a conversation or tap + to start a new one."}
                </div>
              )}
            </div>

            {/* Input area */}
            <form
              onSubmit={send}
              noValidate
              className="px-3 sm:px-[22px] py-3.5 border-t border-hair bg-panel flex gap-2 items-end flex-shrink-0 pb-[calc(env(safe-area-inset-bottom,0px)+14px)]"
            >
              <textarea
                className="input flex-1 resize-none min-h-[44px]"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  recipientId
                    ? "Write a message… (Enter to send)"
                    : "Select a conversation first"
                }
                disabled={!recipientId}
                style={{ fontFamily: "'Public Sans', sans-serif", maxHeight: 120 }}
              />
              <button
                type="submit"
                className="btn-accent px-3 flex-shrink-0 min-h-[44px]"
                disabled={!recipientId || !text.trim() || sending}
                title="Send"
              >
                {sending
                  ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </form>
          </section>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
