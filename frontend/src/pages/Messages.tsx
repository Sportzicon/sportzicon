import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner } from "../components/UI";

function pairId(a: string, b: string) { return [a, b].sort().join("_"); }

export default function Messages() {
  const me = useAuthStore((s) => s.user)!;
  const [params, setParams] = useSearchParams();
  const initialTo = params.get("to") ?? "";
  const [activeId, setActiveId] = useState<string | null>(initialTo ? pairId(me.id, initialTo) : null);
  const [text, setText] = useState("");
  const [recipient, setRecipient] = useState<string | null>(initialTo || null);
  const qc = useQueryClient();

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

  useEffect(() => {
    if (activeId) api.post(`/conversations/${activeId}/read`).catch(() => undefined);
  }, [activeId, messages.data?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !recipient) return;
    await api.post("/messages", { recipient_id: recipient, body: text });
    setText("");
    qc.invalidateQueries({ queryKey: ["msgs", activeId] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  function pickConversation(c: any) {
    const otherId = c.participant_ids.find((p: string) => p !== me.id);
    setActiveId(c.id);
    setRecipient(otherId);
    setParams({});
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Messages" />
      <div className="card grid sm:grid-cols-[260px_1fr] divide-x">
        <aside className="max-h-[60vh] overflow-y-auto">
          {convs.isLoading ? <Spinner /> : convs.data?.length ? (
            <ul>
              {convs.data.map((c) => {
                const otherId = c.participant_ids.find((p: string) => p !== me.id);
                const unread = c.unread_counts?.[me.id] ?? 0;
                return (
                  <li key={c.id}>
                    <button onClick={() => pickConversation(c)} className={`w-full text-left p-3 hover:bg-slate-50 ${activeId === c.id ? "bg-slate-50" : ""}`}>
                      <div className="font-medium text-sm flex justify-between">
                        <span>{otherId?.slice(0, 8)}…</span>
                        {!!unread && <span className="rounded-full bg-red-600 text-white text-xs px-2">{unread}</span>}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{c.last_message?.body ?? "—"}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <div className="p-4 text-sm text-slate-600">No conversations yet.</div>}
        </aside>
        <section className="flex flex-col min-h-[60vh] max-h-[60vh]">
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
            {messages.data?.map((m: any) => (
              <div key={m.id} className={`max-w-md rounded-lg px-3 py-2 text-sm ${m.sender_id === me.id ? "ml-auto bg-brand-600 text-white" : "bg-white border"}`}>
                {m.body}
                <div className={`mt-1 text-[10px] ${m.sender_id === me.id ? "text-brand-100" : "text-slate-500"}`}>{new Date(m.created_at).toLocaleTimeString()}</div>
              </div>
            ))}
            {!messages.data?.length && <div className="text-center text-sm text-slate-500">Pick a conversation, or start one from a profile.</div>}
          </div>
          <form onSubmit={send} className="p-3 border-t bg-white flex gap-2">
            <input className="input flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder={recipient ? "Type a message..." : "Open or start a conversation first"} disabled={!recipient} />
            <button className="btn-primary" disabled={!recipient || !text.trim()}>Send</button>
          </form>
        </section>
      </div>
    </div>
  );
}
