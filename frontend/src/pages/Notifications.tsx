import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";
import { Link } from "react-router-dom";

const ICONS: Record<string, { icon: string; color: string }> = {
  shortlisted:        { icon: "♛", color: "#2B66C9" },
  application_shortlisted: { icon: "♛", color: "#2B66C9" },
  application_selected:    { icon: "✓", color: "#2E7D52" },
  application_rejected:    { icon: "✕", color: "#C0392B" },
  new_message:        { icon: "❝", color: "#14110D" },
  new_follower:       { icon: "◴", color: "#726B60" },
  new_application:    { icon: "◆", color: "#FA4D14" },
  verification_approved: { icon: "✓", color: "#2E7D52" },
  verification_rejected: { icon: "✕", color: "#C0392B" },
};

function getIcon(type: string) {
  return ICONS[type] ?? { icon: "◆", color: "#FA4D14" };
}

export default function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifs"],
    queryFn: async () => (await api.get("/notifications")).data.items as any[]
  });
  const markAll = useMutation({
    mutationFn: async () => api.post("/notifications/read", { ids: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifs"] });
      qc.invalidateQueries({ queryKey: ["notif-count"] });
    }
  });

  const unread = q.data?.filter((n) => !n.read).length ?? 0;

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Notifications"
        subtitle="Activity"
        action={
          unread > 0 && (
            <button className="btn-ghost" onClick={() => markAll.mutate()}>
              Mark all read
            </button>
          )
        }
      />

      {q.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : q.data?.length ? (
        <div className="panel divide-y divide-hairsoft">
          {q.data.map((n, i) => {
            const { icon, color } = getIcon(n.type);
            return (
              <div
                key={n.id}
                className={`flex gap-4 px-5 py-4 transition hover:bg-fill/50 ${!n.read ? "bg-fill" : ""}`}
              >
                <span
                  className="w-9 h-9 rounded-full border border-hair flex items-center justify-center text-[13px] flex-shrink-0 bg-panel"
                  style={{ color }}
                >
                  {icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className={`text-[13.5px] ${!n.read ? "font-semibold text-ink" : "font-medium text-ink-70"}`}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div className="text-sm text-ink-sub mt-0.5 leading-snug">{n.body}</div>
                  )}
                  <div className="lab mt-2">{new Date(n.created_at).toLocaleString()}</div>
                  {n.link && (
                    <Link to={n.link} className="font-mononum text-[10px] uppercase tracking-[0.08em] text-brand-500 mt-1 inline-block hover:underline">
                      View →
                    </Link>
                  )}
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-8 text-center">
          <div className="font-disp text-xl text-ink-70">All caught up</div>
          <p className="text-sm text-ink-sub mt-2">No notifications yet. Activity from the network will appear here.</p>
        </div>
      )}
    </div>
  );
}
