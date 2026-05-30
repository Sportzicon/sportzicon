import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, Avatar } from "../components/UI";
import { Send } from "lucide-react";

function pairId(a: string, b: string) { return [a, b].sort().join("_"); }

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
  const [activeId, setActiveId] = useState<string | null>(initialTo ? pairId(me.id, initialTo) : null);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState<string | null>(initialTo || null);
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const convs = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await api.get<{ items: any[] }>("/conversations")).data.items,
    refetchInterval: 15_000
  });

  const messages = useQuery({
    queryKey: ["msgs", activeId],
    queryFn: async () =>
      activeId ? (await api.get<{ items: any[] }>(`/conversations/${activeId}/messages`)).data.items : [],
    enabled: !!activeId,
    refetchInterval: 5_000
  });

  // scroll to bottom when messages load/update
  useEffect(() => {
    if (endRef.current) endRef.current.scrollTop = endRef.current.scrollHeight;
  }, [messages.data?.length, activeId]);

  // mark read on open
  useEffect(() => {
    if (activeId) api.post(`/conversations/${activeId}/read`).catch(() => undefined);
  }, [activeId, messages.data?.length]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !recipient) return;
    await api.post("/messages", { recipient_id: recipient, body: text });
    setText("");
    qc.invalidateQueries({ queryKey: ["msgs", activeId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function pickConversation(c: any) {
    const otherId = c.participant_ids.find((p: string) => p !== me.id);
    setActiveId(c.id);
    setRecipient(otherId);
    setParams({});
  }

  // derive active conv metadata
  const activeConv = convs.data?.find((c: any) => c.id === activeId);
  const activeOtherId = activeConv?.participant_ids?.find((p: string) => p !== me.id);

  return (
    <div className="space-y-0 h-full">
      <PageHeader title="Messages" subtitle="Inbox" />

      <div className="panel grid sm:grid-cols-[320px_1fr] divide-x divide-hair"
        style={{ height: "calc(100vh - 200px)", minHeight: 500 }}>

        {/* ── conversation list ──────────────────────────────── */}
        <aside className="flex flex-col overflow-hidden">
          <div className="px-[18px] py-[18px] border-b border-hair">
            <div className="kicker">Inbox</div>
            <h2 className="font-disp text-2xl mt-1.5">Messages</h2>
          </div>
          <div className="overflow-y-auto flex-1">
            {convs.isLoading ? (
              <div className="p-6 flex justify-center"><Spinner className="text-brand-500" /></div>
            ) : convs.data?.length ? (
              <ul>
                {convs.data.map((c: any) => {
                  const otherId = c.participant_ids.find((p: string) => p !== me.id);
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
                        <Avatar name={otherId?.slice(0, 8) ?? "?"} size={40} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[13.5px] font-semibold text-ink truncate">
                              {otherId?.slice(0, 12)}…
                            </span>
                            <span className="lab flex-shrink-0 text-[10.5px]">
                              {c.last_message?.created_at ? timeAgo(c.last_message.created_at) : ""}
                            </span>
                          </div>
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
            ) : (
              <div className="p-6 text-sm text-ink-sub">No conversations yet. Start one from a profile.</div>
            )}
          </div>
        </aside>

        {/* ── message thread ─────────────────────────────────── */}
        <section className="flex flex-col overflow-hidden min-w-0">
          {/* thread header */}
          {activeConv ? (
            <div className="px-[22px] py-3.5 border-b border-hair bg-panel flex items-center gap-3 flex-shrink-0">
              <Avatar name={activeOtherId?.slice(0, 8) ?? "?"} size={38} />
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-semibold text-ink">{activeOtherId?.slice(0, 16)}…</div>
              </div>
              {activeOtherId && (
                <Link to={`/profile/${activeOtherId}`} className="btn-ghost text-[12px] flex-shrink-0">
                  View profile →
                </Link>
              )}
            </div>
          ) : (
            <div className="px-[22px] py-3.5 border-b border-hair bg-panel">
              <div className="lab">Select a conversation</div>
            </div>
          )}

          {/* messages */}
          <div ref={endRef} className="flex-1 overflow-y-auto px-[22px] py-6 flex flex-col gap-3 bg-fill/30">
            {messages.isLoading ? (
              <div className="flex justify-center pt-8"><Spinner className="text-brand-500" /></div>
            ) : messages.data?.length ? (
              <>
                <div className="lab text-center mb-2">
                  {new Date(messages.data[0].created_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </div>
                {messages.data.map((m: any) => {
                  const isMe = m.sender_id === me.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[62%]">
                        <div className={`px-[14px] py-[11px] text-[13.5px] leading-snug rounded-[10px] ${isMe ? "bg-ink text-paper" : "bg-panel text-ink border border-hair"}`}
                          style={{
                            borderRadius: isMe ? "10px 10px 2px 10px" : "10px 10px 10px 2px"
                          }}>
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

          {/* compose */}
          <form onSubmit={send} className="px-[22px] py-3.5 border-t border-hair bg-panel flex gap-2 items-end flex-shrink-0">
            <textarea
              className="input flex-1 resize-none"
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={recipient ? "Write a message… (Enter to send, Shift+Enter for newline)" : "Select a conversation first"}
              disabled={!recipient}
              style={{ fontFamily: "'Public Sans', sans-serif", minHeight: 42 }}
            />
            <button type="submit" className="btn-accent px-3 flex-shrink-0" disabled={!recipient || !text.trim()} title="Send">
              <Send className="h-4 w-4" />
            </button>
          </form>
          <div className="px-[22px] pb-2 lab text-ink-faint text-[10px]">
            Async messaging · email notification on new message · real-time in Phase 2
          </div>
        </section>
      </div>
    </div>
  );
}
