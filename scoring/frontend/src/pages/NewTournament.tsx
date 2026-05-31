import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Trophy } from "lucide-react";

const SPORTS = ["cricket", "football", "basketball", "volleyball", "hockey", "kabaddi", "tennis", "badminton"];
const FORMATS: Record<string, string[]> = {
  cricket: ["T20", "ODI", "Test", "T10", "The Hundred"],
  football: ["11-a-side", "7-a-side", "5-a-side", "Futsal"],
  basketball: ["5-a-side", "3x3"],
  default: ["League", "Knockout", "Round Robin", "Group + Knockout"]
};

export default function NewTournament() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "", sport: "cricket", format: "T20",
    description: "", start_date: "", end_date: "",
    location: "", logo_url: "", is_public: true
  });
  const [error, setError] = useState("");

  const { data: existing } = useQuery({
    queryKey: ["tournament", id],
    queryFn: () => api.get(`/tournaments/${id}`).then(r => r.data.tournament),
    enabled: isEdit
  });

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || "",
        sport: existing.sport || "cricket",
        format: existing.format || "",
        description: existing.description || "",
        start_date: existing.start_date || "",
        end_date: existing.end_date || "",
        location: existing.location || "",
        logo_url: existing.logo_url || "",
        is_public: existing.is_public ?? true
      });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? api.put(`/tournaments/${id}`, data).then(r => r.data.tournament)
        : api.post("/tournaments", data).then(r => r.data.tournament),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      navigate(`/tournaments/${t.id}`);
    },
    onError: (err: any) => setError(err.response?.data?.error?.message || "Failed to save")
  });

  function update(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  const formatOptions = FORMATS[form.sport] || FORMATS.default;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="w-6 h-6 text-emerald-600" />
        <h1 className="text-2xl font-bold">{isEdit ? "Edit Tournament" : "New Tournament"}</h1>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md">{error}</div>}

      <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="card p-6 space-y-5">
        <div>
          <label className="label">Tournament Name *</label>
          <input className="input" value={form.name} onChange={e => update("name", e.target.value)} required placeholder="e.g. Greenfield Cup 2025" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Sport *</label>
            <select className="input" value={form.sport} onChange={e => { update("sport", e.target.value); update("format", ""); }}>
              {SPORTS.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Format</label>
            <select className="input" value={form.format} onChange={e => update("format", e.target.value)}>
              <option value="">Select format</option>
              {formatOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={e => update("description", e.target.value)} placeholder="About this tournament…" />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Start Date</label>
            <input className="input" type="date" value={form.start_date} onChange={e => update("start_date", e.target.value)} />
          </div>
          <div>
            <label className="label">End Date</label>
            <input className="input" type="date" value={form.end_date} onChange={e => update("end_date", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location} onChange={e => update("location", e.target.value)} placeholder="City, Venue" />
        </div>

        <div>
          <label className="label">Logo URL</label>
          <input className="input" type="url" value={form.logo_url} onChange={e => update("logo_url", e.target.value)} placeholder="https://…" />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="public" checked={form.is_public} onChange={e => update("is_public", e.target.checked)} className="rounded border-gray-300 text-emerald-600" />
          <label htmlFor="public" className="text-sm text-gray-700">Make this tournament public (visible to all)</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Tournament"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
        </div>
      </form>
    </div>
  );
}
