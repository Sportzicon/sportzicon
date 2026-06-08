import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { messageService, userService } from "../services";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Avatar } from "../components/UI";
import { Send } from "lucide-react";
import type { Conversation, Message } from "../models";


function makeDemoData(meId: string) {
  const T = Date.now();
  const ids = { a: "demo_priya_001", b: "demo_cfc_001", c: "demo_rahul_001" };

  const convs = [
    {
      id: "demo_conv_a", participant_ids: [meId, ids.a],
      _other_name: "Priya Verma", _other_sub: "Scout · Mumbai",
      last_message: { body: "Looking forward to seeing you at the trials!", created_at: new Date(T - 90 * 60_000).toISOString() },
      unread_counts: { [meId]: 2 }
    },
    {
      id: "demo_conv_b", participant_ids: [meId, ids.b],
      _other_name: "Chennai FC Academy", _other_sub: "Club · Chennai",
      last_message: { body: "Are you currently open to new opportunities?", created_at: new Date(T - 5 * 3600_000).toISOString() },
      unread_counts: {}
    },
    {
      id: "demo_conv_c", participant_ids: [meId, ids.c],
      _other_name: "Rahul Mehta", _other_sub: "Athlete · Delhi",
      last_message: { body: "Sure, Shivaji Park at 6am works! See you tomorrow.", created_at: new Date(T - 20 * 3600_000).toISOString() },
      unread_counts: {}
    }
  ];

  const msgs: Record<string, any[]> = {
    demo_conv_a: [
      { id: "da1", sender_id: ids.a, body: "Hi! I came across your Sportzicon profile — really impressive stats.", created_at: new Date(T - 3 * 3600_000).toISOString() },
      { id: "da2", sender_id: ids.a, body: "We're holding state-level cricket trials next month. Based on your numbers, you'd be a strong candidate.", created_at: new Date(T - 3 * 3600_000 + 30_000).toISOString() },
      { id: "da3", sender_id: meId, body: "Thanks for reaching out! I'd be very interested. Can you share more details about the format and location?", created_at: new Date(T - 2 * 3600_000).toISOString() },
      { id: "da4", sender_id: ids.a, body: "It's a 2-day selection camp at the Wankhede Academy — 15–16 July. U-23 category.", created_at: new Date(T - 100 * 60_000).toISOString() },
      { id: "da5", sender_id: meId, body: "Perfect, I'll clear my schedule. Please send the registration form when it's ready.", created_at: new Date(T - 95 * 60_000).toISOString() },
      { id: "da6", sender_id: ids.a, body: "Looking forward to seeing you at the trials!", created_at: new Date(T - 90 * 60_000).toISOString() }
    ],
    demo_conv_b: [
      { id: "db1", sender_id: ids.b, body: "Hello! We noticed your profile and think you'd be a great fit for our Academy development program.", created_at: new Date(T - 6 * 3600_000).toISOString() },
      { id: "db2", sender_id: ids.b, body: "Are you currently open to new opportunities?", created_at: new Date(T - 5 * 3600_000).toISOString() }
    ],
    demo_conv_c: [
      { id: "dc1", sender_id: meId, body: "Hey Rahul, saw you're also preparing for the state trials. Want to do a joint training session sometime?", created_at: new Date(T - 25 * 3600_000).toISOString() },
      { id: "dc2", sender_id: ids.c, body: "Absolutely! I train at Shivaji Park every morning. You're welcome to join.", created_at: new Date(T - 22 * 3600_000).toISOString() },
      { id: "dc3", sender_id: meId, body: "That sounds great. Tomorrow morning?", created_at: new Date(T - 21 * 3600_000).toISOString() },
      { id: "dc4", sender_id: ids.c, body: "Sure, Shivaji Park at 6am works! See you tomorrow.", created_at: new Date(T - 20 * 3600_000).toISOString() }
    ]
  };

  return { convs, msgs };
}

function timeAgo(ts: string) {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return "just now";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}h`;
  return `${Math.floor(d / 86400_000)}d`;
}

export default function Messages() {
  const me = useAuthStore((s) => s.user)!;
  const [params, setParams] = useSearchParams();
  const initialTo = params.get("to") ?? "";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState<string | null>(initialTo || null);
  const [mobileView, setMobileView] = useState<"list" | "thread">(initialTo ? "thread" : "list");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const to = params.get("to");
    if (to && to !== recipient) {
      setActiveId(null);
      setRecipient(to);
      setMobileView("thread");
      setParams({}, { replace: true });
    }
  }, [params]);
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["conversations"],
    queryFn: () => messageService.getConversations(),
    refetchInterval: 15_000
  });

  const isDemo = !convs.isLoading && !convs.data?.length;

  useEffect(() => {
    if (!convs.data || !recipient) return;
    const existing = convs.data.find((c: Conversation) => c.participant_ids.includes(recipient));
    if (existing && activeId !== existing.id) setActiveId(existing.id);
  }, [convs.data, recipient]);

  const recipientProfile = useQuery({
    queryKey: ["user", recipient],
    queryFn: () => userService.get(recipient!),
    enabled: !!recipient && !activeId && !isDemo,
  });

  const messages = useQuery({
    queryKey: ["msgs", activeId],
    queryFn: () => messageService.getMessages(activeId!),
    enabled: !!activeId,
    refetchInterval: 5_000
  });

  useEffect(() => {
    if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;
  }, [messages.data?.length, activeId]);

  useEffect(() => {
    if (activeId) messageService.markRead(activeId).catch(() => undefined);
  }, [activeId, messages.data?.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !recipient || sending) return;
    setSending(true);
    try {
      await messageService.send({ recipient_id: recipient, body: text });
      setText("");
      qc.invalidateQueries({ queryKey: ["msgs", activeId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); send(); }
  }

  function pickConversation(c: any) {
    const otherId = c.participant_ids.find((p: string) => p !== me.id);
    setActiveId(c.id);
    setRecipient(otherId);
    setParams({});
    setMobileView("thread");
  }

  const demo = useMemo(() => makeDemoData(me.id), [me.id]);
  const isDemoConv = activeId?.startsWith("demo_conv_");

  const displayConvs = isDemo ? demo.convs : (convs.data ?? []);
  const displayMessages = isDemoConv ? (demo.msgs[activeId ?? ""] ?? []) : (messages.data ?? []);

  const activeConv = displayConvs.find((c: any) => c.id === activeId);
  const activeOtherId = activeConv?.participant_ids?.find((p: string) => p !== me.id);
  const activeDisplayName =
    (activeConv as any)?._other_name ??
    (activeOtherId ? activeOtherId.slice(0, 16) : undefined) ??
    recipientProfile.data?.full_name ??
    recipient?.slice(0, 16);

  return (
    <div className="space-y-0 h-full">
      <PageHeader title="Messages" subtitle="Inbox" />

      <div className="panel overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 420 }}>
        <div className="grid h-full sm:grid-cols-[320px_1fr] sm:divide-x sm:divide-hair">

        {/* ── conversation list ──────────────────────────────── */}
        <aside className={`${mobileView === "thread" ? "hidden sm:flex" : "flex"} flex-col overflow-hidden`}>
          <div className="px-[18px] py-[18px] border-b border-hair">
            <div className="kicker">Inbox</div>
            <h2 className="font-disp text-2xl mt-1.5">Messages</h2>
          </div>
          <div className="overflow-y-auto flex-1 flex flex-col">
            {convs.isLoading ? (
              <div className="p-6 flex justify-center"><Spinner className="text-brand-500" /></div>
            ) : (
              <>
                {isDemo && (
                  <div className="px-4 py-2 bg-fill border-b border-hairsoft">
                    <span className="font-mononum text-[10px] uppercase tracking-[0.06em] text-ink-faint">Demo preview</span>
                  </div>
                )}
                <ul className="flex-1">
                  {displayConvs.map((c: any) => {
                    const otherId = c.participant_ids.find((p: string) => p !== me.id);
                    const displayName = c._other_name ?? otherId?.slice(0, 12);
                    const displaySub = c._other_sub ?? "";
                    const unread = c.unread_counts?.[me.id] ?? 0;
                    const isActive = activeId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => pickConversation(c)}
                          className="w-full text-left flex items-start gap-3 px-4 py-3.5 border-b border-hairsoft transition"
                          style={{
                            background: isActive ? "#F2F1EC" : "transparent",
                            borderLeft: `2px solid ${isActive ? "#FA4D14" : "transparent"}`
                          }}
                        >
                          <Avatar name={displayName ?? "?"} size={40} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13.5px] font-semibold text-ink truncate">{displayName}</span>
                              <span className="lab flex-shrink-0 text-[10.5px]">
                                {c.last_message?.created_at ? timeAgo(c.last_message.created_at) : ""}
                              </span>
                            </div>
                            {displaySub && <div className="lab text-[10.5px] mt-0.5">{displaySub}</div>}
                            <div className="text-[12.5px] text-ink-sub truncate mt-1 leading-snug">
                              {c.last_message?.body ?? "—"}
                            </div>
                          </div>
                          {!!unread && (
                            <span className="font-mononum text-[9px] w-4 h-4 rounded-full bg-brand-500 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                              {unread}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {isDemo && (
                  <div className="px-4 py-3 border-t border-hairsoft">
                    <p className="lab text-ink-faint text-[10.5px] text-center leading-relaxed">
                      Sample data · <Link to="/search" className="text-brand-500 hover:underline">Find a user</Link> to start a real conversation
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ── message thread ─────────────────────────────────── */}
        <section className={`${mobileView === "list" ? "hidden sm:flex" : "flex"} flex-col overflow-hidden min-w-0`}>
          {(activeConv || recipient) ? (
            <div className="px-3 sm:px-[22px] py-3.5 border-b border-hair bg-panel flex items-center gap-3 flex-shrink-0">
              <button
                className="sm:hidden -ml-1 mr-1 p-2 rounded text-ink-70 hover:bg-fill transition flex-shrink-0"
                onClick={() => setMobileView("list")}
                aria-label="Back to conversations"
              >
                ←
              </button>
              <Avatar name={activeDisplayName ?? "?"} size={38} />
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold text-ink">{activeDisplayName ?? "New conversation"}</div>
                {(activeConv as any)?._other_sub && (
                  <div className="lab text-[10.5px] mt-0.5">{(activeConv as any)._other_sub}</div>
                )}
                {!activeConv && recipient && !isDemoConv && (
                  <div className="lab text-[10.5px] mt-0.5">New conversation</div>
                )}
              </div>
              {!isDemoConv && (recipient || activeOtherId) && (
                <Link to={`/profile/${recipient ?? activeOtherId}`} className="btn-ghost text-[12px] flex-shrink-0">
                  View profile →
                </Link>
              )}
            </div>
          ) : (
            <div className="px-[22px] py-3.5 border-b border-hair bg-panel">
              <div className="lab">Select a conversation</div>
            </div>
          )}

          <div ref={endRef} className="flex-1 overflow-y-auto px-[22px] py-6 flex flex-col gap-3 bg-fill/30">
            {!isDemoConv && messages.isLoading ? (
              <div className="flex justify-center pt-8"><Spinner className="text-brand-500" /></div>
            ) : displayMessages.length ? (
              <>
                <div className="lab text-center mb-2">
                  {new Date(displayMessages[0].created_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </div>
                {displayMessages.map((m: Message) => {
                  const isMe = m.sender_id === me.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[62%]">
                        <div className={`px-[14px] py-[11px] text-[13.5px] leading-snug rounded-[10px] ${isMe ? "bg-ink text-paper" : "bg-panel text-ink border border-hair"}`}
                          style={{ borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px" }}>
                          {m.body}
                        </div>
                        <div className={`lab mt-1 text-[10.5px] ${isMe ? "text-right" : "text-left"}`}>
                          {timeAgo(m.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center text-sm text-ink-sub pt-12">
                {activeId ? "No messages yet. Say hello." : "Pick a conversation to start reading, or start one from a profile."}
              </div>
            )}
          </div>

          <form onSubmit={send} className="px-3 sm:px-[22px] py-3.5 border-t border-hair bg-panel flex gap-2 items-end flex-shrink-0">
            <textarea
              className="input flex-1 resize-none"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isDemoConv ? "Demo conversation — find a real user to message" : recipient ? "Write a message… (Enter to send, Shift+Enter for newline)" : "Select a conversation first"}
              disabled={!recipient || isDemoConv}
              style={{ fontFamily: "'Public Sans', sans-serif", minHeight: 42 }}
            />
            <button type="submit" className="btn-accent px-3 flex-shrink-0" disabled={!recipient || !text.trim() || isDemoConv || sending} title="Send">
              {sending ? <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </section>
        </div>
      </div>
    </div>
  );
}
