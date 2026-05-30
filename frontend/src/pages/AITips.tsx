import { useMutation } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner, Kicker } from "../components/UI";

export default function AITips() {
  const m = useMutation({
    mutationFn: async () => (await api.post("/ai/athlete-tips")).data
  });

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="AI Performance Tips"
        subtitle="◆ AI coaching"
        action={
          <button className="btn-accent" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Thinking…" : "◆ Get tips"}
          </button>
        }
      />

      {!m.data && !m.isPending && !m.isError && (
        <div className="panel p-8 text-center border-dashed">
          <div className="w-14 h-14 rounded-full bg-brand-50 text-brand-500 flex items-center justify-center text-2xl mx-auto">◆</div>
          <h3 className="font-disp text-2xl mt-4">Personalised coaching tips</h3>
          <p className="text-sm text-ink-sub mt-2 leading-relaxed max-w-xs mx-auto">
            AI analyses your sport, role, stats and experience to generate specific, actionable recommendations.
          </p>
          <button className="btn-accent mt-5" onClick={() => m.mutate()}>Get my tips →</button>
        </div>
      )}

      {m.isPending && (
        <div className="panel p-10 flex flex-col items-center gap-4">
          <Spinner className="text-brand-500 h-8 w-8" />
          <p className="lab">Analysing your profile…</p>
        </div>
      )}

      {m.isError && (
        <div className="rounded bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          {getApiError(m.error).message}
        </div>
      )}

      {m.data && (
        <div className="space-y-4 animate-fadein">
          {m.data.focus_areas?.length > 0 && (
            <div className="panel p-6">
              <Kicker>Focus areas</Kicker>
              <div className="mt-4 flex flex-wrap gap-2">
                {m.data.focus_areas.map((f: string, i: number) => (
                  <span key={i} className="badge bg-brand-50 text-brand-700 border-brand-200">{f}</span>
                ))}
              </div>
            </div>
          )}

          <div className="panel p-6">
            <Kicker>Recommended actions</Kicker>
            <ol className="mt-4 space-y-4">
              {m.data.tips?.map((t: string, i: number) => (
                <li key={i} className="flex gap-4">
                  <span className="font-disp text-3xl text-brand-500 leading-none flex-shrink-0 mt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[14.5px] text-ink-70 leading-relaxed">{t}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-center justify-between">
            <span className="lab">Source: {m.data.source}{m.data.model ? ` · ${m.data.model}` : ""}</span>
            <button className="btn-ghost" onClick={() => m.mutate()}>Regenerate →</button>
          </div>
        </div>
      )}
    </div>
  );
}
