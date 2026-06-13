import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoringApi } from "../../api/scoringClient";
import { PageHeader } from "../../components/UI";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi"];
const FORMATS: Record<string, string[]> = {
  cricket: ["T20", "ODI", "Test", "T10", "The Hundred", "Custom"],
  football: ["11-a-side", "7-a-side", "5-a-side"],
  default: ["League", "Knockout", "Round Robin", "Group + Knockout"]
};
const MATCH_TYPES = ["league", "tournament", "friendly", "trial", "academy", "knockout"];

function ScoringNewTournamentInner() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({ name: "", sport: "cricket", format: "T20", season: "", match_type: "tournament", description: "", start_date: "", end_date: "", location: "", is_public: true });
  const [error, setError] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["scoring-tournament", id],
    queryFn: () => scoringApi.get(`/tournaments/${id}`).then(r => r.data.tournament),
    enabled: isEdit
  });

  useEffect(() => {
    if (existing) setForm({ name: existing.name || "", sport: existing.sport || "cricket", format: existing.format || "T20", season: existing.season || "", match_type: existing.match_type || "tournament", description: existing.description || "", start_date: existing.start_date || "", end_date: existing.end_date || "", location: existing.location || "", is_public: existing.is_public ?? true });
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (data: any) => isEdit
      ? scoringApi.put(`/tournaments/${id}`, data).then(r => r.data.tournament)
      : scoringApi.post("/tournaments", data).then(r => r.data.tournament),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["scoring-tournaments"] });
      navigate(`/scoring/tournaments/${t.id}`);
    },
    onError: (err: any) => setError(err.response?.data?.error?.message || "Failed to save")
  });

  const formatOptions = FORMATS[form.sport] || FORMATS.default;

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title={isEdit ? "Edit Tournament" : "New Tournament"} subtitle="Cricket & multi-sport scoring" />

      {error && <div className="panel p-3 text-sm text-red-600 bg-red-50 border-red-200">{error}</div>}

      <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="card p-6 space-y-5">
        <div>
          <label className="lab block mb-1">Tournament name *</label>
          <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Summer Cricket Cup 2026" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="lab block mb-1">Sport</label>
            <select className="input w-full" value={form.sport} onChange={e => setForm(f => ({ ...f, sport: e.target.value, format: "" }))}>
              {SPORTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="lab block mb-1">Format</label>
            <select className="input w-full" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
              <option value="">Select format</option>
              {formatOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="lab block mb-1">Match Type</label>
            <select className="input w-full" value={form.match_type} onChange={e => setForm(f => ({ ...f, match_type: e.target.value }))}>
              {MATCH_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="lab block mb-1">Season</label>
            <input className="input w-full" value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))} placeholder="e.g. 2026 or 2025-26" />
          </div>
        </div>
        <div>
          <label className="lab block mb-1">Description</label>
          <textarea className="input w-full" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="About this tournament…" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="lab block mb-1">Start Date</label>
            <input className="input w-full" type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="lab block mb-1">End Date</label>
            <input className="input w-full" type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="lab block mb-1">Location</label>
          <input className="input w-full" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="City, Venue" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} className="rounded border-hair" />
          <span className="text-sm text-ink">Make this tournament public</span>
        </label>
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create tournament"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default function ScoringNewTournament() {
  return <ScoringNewTournamentInner />;
}
