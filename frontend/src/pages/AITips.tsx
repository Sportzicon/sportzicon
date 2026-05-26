import { useMutation } from "@tanstack/react-query";
import { api, getApiError } from "../api/client";
import { PageHeader, Spinner } from "../components/UI";

export default function AITips() {
  const m = useMutation({
    mutationFn: async () => (await api.post("/ai/athlete-tips")).data
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title="AI Performance Tips"
        subtitle="Personalised suggestions based on your sport, stats, and experience."
        action={<button className="btn-primary" disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Thinking..." : "Get tips"}</button>}
      />
      {m.isPending && <Spinner />}
      {m.isError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{getApiError(m.error).message}</div>}
      {m.data && (
        <div className="card card-body space-y-3">
          {m.data.focus_areas?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold">Focus areas</h3>
              <ul className="mt-1 list-disc list-inside text-sm text-slate-700">
                {m.data.focus_areas.map((f: string, i: number) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold">Recommended actions</h3>
            <ol className="mt-1 list-decimal list-inside text-sm space-y-1">
              {m.data.tips?.map((t: string, i: number) => <li key={i}>{t}</li>)}
            </ol>
          </div>
          <p className="text-xs text-slate-500">Source: {m.data.source}{m.data.model ? ` (${m.data.model})` : ""}</p>
        </div>
      )}
    </div>
  );
}
