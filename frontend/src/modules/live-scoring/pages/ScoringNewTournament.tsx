import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scoringApi } from "../../../api/scoringClient";
import { api } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { PageHeader } from "../../../components/UI";
import { Link2, Trophy, ArrowLeft } from "lucide-react";

const CRICKET_FORMATS = ["T20", "ODI", "Test", "T10", "The Hundred", "Custom"];
const MATCH_TYPES = ["league", "tournament", "friendly", "trial", "academy", "knockout"];

type FormState = {
  name: string; sport: string; format: string; season: string;
  match_type: string; description: string; start_date: string;
  end_date: string; location: string; is_public: boolean;
};

function ScoringNewTournamentInner() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Pre-fill source: opportunity_id from URL (when launched from main app tournament)
  const opportunityId = searchParams.get("opportunity_id") ?? null;

  const [form, setForm] = useState<FormState>({
    name: "", sport: "cricket", format: "T20", season: "",
    match_type: "tournament", description: "", start_date: "",
    end_date: "", location: "", is_public: true
  });
  const [error, setError] = useState("");

  // Load existing scoring tournament (edit mode)
  const { data: existing } = useQuery({
    queryKey: queryKeys.scoringTournament(id ?? ""),
    queryFn: () => scoringApi.get(`/tournaments/${id}`).then(r => r.data.tournament),
    enabled: isEdit
  });

  // Load source opportunity (create mode, when launched from main app)
  const { data: sourceOpportunity } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => api.get(`/opportunities/${opportunityId}`).then(r => r.data.opportunity),
    enabled: !isEdit && Boolean(opportunityId),
    staleTime: 60_000
  });

  // Pre-fill from existing scoring tournament (edit)
  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name || "",
        sport: "cricket",
        format: existing.format || "T20",
        season: existing.season || "",
        match_type: existing.match_type || "tournament",
        description: existing.description || "",
        start_date: existing.start_date || "",
        end_date: existing.end_date || "",
        location: existing.location || "",
        is_public: existing.is_public ?? true
      });
    }
  }, [existing]);

  // Pre-fill from linked opportunity (create from main app)
  useEffect(() => {
    if (sourceOpportunity && !isEdit) {
      setForm(f => ({
        ...f,
        name: sourceOpportunity.title || f.name,
        description: sourceOpportunity.description || f.description,
        start_date: sourceOpportunity.start_date || f.start_date,
        end_date: sourceOpportunity.end_date || f.end_date,
        location: sourceOpportunity.city ? `${sourceOpportunity.city}${sourceOpportunity.state ? ", " + sourceOpportunity.state : ""}` : f.location
      }));
    }
  }, [sourceOpportunity, isEdit]);

  const mutation = useMutation({
    mutationFn: async (data: FormState & { opportunity_id?: string }) => {
      if (isEdit) {
        return scoringApi.put(`/tournaments/${id}`, data).then(r => r.data.tournament);
      }
      const t = await scoringApi.post("/tournaments", data).then(r => r.data.tournament);
      // After creating scoring tournament, back-link to the opportunity in main app
      if (opportunityId && t?.id) {
        await api.patch(`/opportunities/${opportunityId}/scoring-link`, {
          scoring_tournament_id: t.id
        }).catch(() => {}); // non-fatal
      }
      return t;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: queryKeys.scoringTournaments({}) });
      if (opportunityId) {
        qc.invalidateQueries({ queryKey: queryKeys.opportunities({}) });
        qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      }
      navigate(`/scoring/tournaments/${t.id}`);
    },
    onError: (err: any) => setError(err.response?.data?.error?.message || "Failed to save")
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <Link
        to={isEdit ? `/scoring/tournaments/${id}` : "/scoring/tournaments"}
        className="inline-flex items-center gap-1.5 lab text-ink-sub hover:text-ink transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> {isEdit ? "Back to tournament" : "Back to tournaments"}
      </Link>
      <PageHeader
        title={isEdit ? "Edit Tournament" : "Set Up Scoring"}
        subtitle={sourceOpportunity ? `Setting up scoring for: ${sourceOpportunity.title}` : "Cricket & multi-sport scoring"}
      />

      {/* Banner when linked to a main app tournament */}
      {sourceOpportunity && !isEdit && (
        <div className="card p-4 border-brand-200 bg-brand-50/50 flex items-start gap-3">
          <Link2 className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-ink">Linking to tournament opportunity</p>
            <p className="lab text-ink-sub mt-0.5">
              <span className="font-medium">{sourceOpportunity.title}</span>
              {" · "}{sourceOpportunity.sport}
              {sourceOpportunity.city && ` · ${sourceOpportunity.city}`}
            </p>
            <p className="lab text-ink-faint mt-0.5">
              {sourceOpportunity.application_count ?? 0} applications ·
              deadline {sourceOpportunity.application_deadline}
            </p>
          </div>
        </div>
      )}

      {error && <div className="panel p-3 text-sm text-red-600 bg-red-50 border-red-200">{error}</div>}

      <form
        onSubmit={e => {
          e.preventDefault();
          if (form.start_date && form.end_date && form.end_date < form.start_date) {
            setError("End date must be on or after start date");
            return;
          }
          setError("");
          mutation.mutate({ ...form, ...(opportunityId ? { opportunity_id: opportunityId } : {}) });
        }}
        className="card p-6 space-y-5"
      >
        <div>
          <label className="lab block mb-1">Tournament name *</label>
          <input
            className="input w-full"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
            placeholder="e.g. Summer Cricket Cup 2026"
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="lab block mb-1">Sport</label>
            <input className="input w-full" value="Cricket" disabled />
          </div>
          <div>
            <label className="lab block mb-1">Format</label>
            <select className="input w-full" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
              <option value="">Select format</option>
              {CRICKET_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
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
            <input className="input w-full" type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
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
            {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : opportunityId ? "Set up scoring" : "Create tournament"}
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
