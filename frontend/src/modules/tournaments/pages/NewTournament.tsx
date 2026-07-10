import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { humanizeError } from "../../../api/client";
import { useAuthStore } from "../../../store/auth";
import { isAdmin } from "../../../utils/roles";
import { PageHeader, Spinner, SectionHead } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import { SPORTS_LIST } from "../../../data/sportPositions";
import { useOrgTournamentForm, useOrgTournament } from "../hooks/useOrgTournaments";
import { Trash2 } from "lucide-react";

const STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Live now" },
  { value: "completed", label: "Completed" },
] as const;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
    </label>
  );
}

export default function NewTournament() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const admin = isAdmin(user?.role ?? "");
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;

  const { orgs, existing, save } = useOrgTournamentForm(id);
  const { addTeam, removeTeam } = useOrgTournament(id ?? "");

  const [form, setForm] = useState({ org_id: "", name: "", sport: "", season: "", status: "upcoming" as string });
  const [newTeamName, setNewTeamName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.org_id && orgs.data?.length) setForm((f) => ({ ...f, org_id: orgs.data![0].id }));
    // Defaults org_id once when orgs load; form.org_id is read as a guard, not a trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgs.data]);

  useEffect(() => {
    if (existing.data) {
      const t = existing.data;
      setForm({
        org_id: t.organization_id || "",
        name: t.name || "",
        sport: t.sport || "",
        season: t.season || "",
        status: t.status || "upcoming",
      });
    }
  }, [existing.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const payload = isEdit
        ? { name: form.name, sport: form.sport, season: form.season || undefined, status: form.status as "upcoming" | "ongoing" | "completed" }
        : { name: form.name, sport: form.sport, season: form.season || undefined };
      await save.mutateAsync({ orgId: form.org_id, data: payload });
      navigate("/tournaments");
    } catch (e) {
      setErr(humanizeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (isEdit && existing.isPending) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;

  if (!isEdit && !admin && !orgs.data?.length) {
    return (
      <div className="panel p-8 max-w-lg">
        <div className="kicker">Organization required</div>
        <h2 className="font-disp text-3xl mt-2">Create an organization first</h2>
        <p className="text-sm text-ink-sub mt-3 leading-relaxed">You need an organization profile before posting a tournament.</p>
        <button className="btn-accent mt-5 min-h-[44px]" onClick={() => navigate("/organizations/new")}>Create organization →</button>
      </div>
    );
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={submit} noValidate className="space-y-6 max-w-2xl">
      <BackButton to="/tournaments" label="Tournaments" />
      <PageHeader
        title={isEdit ? "Edit tournament" : "New tournament"}
        subtitle="Live and upcoming events"
        sticky
      />

      <div className="panel p-6 space-y-4">
        <SectionHead n="01" title="Details" />
        <Field label="Organization">
          <select className="input min-h-[44px]" value={form.org_id} onChange={(e) => set("org_id", e.target.value)} disabled={isEdit}>
            {admin && !isEdit && <option value="">Select organization…</option>}
            {orgs.data?.map((o) => <option key={o.id} value={o.id}>{o.org_name}</option>)}
          </select>
        </Field>
        <Field label="Tournament name *">
          <input className="input min-h-[44px]" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Sport *">
            <select className="input min-h-[44px]" value={form.sport} onChange={(e) => set("sport", e.target.value)} required>
              <option value="">Select sport…</option>
              {SPORTS_LIST.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Season" hint="e.g. 2026, Winter 2026">
            <input className="input min-h-[44px]" value={form.season} onChange={(e) => set("season", e.target.value)} />
          </Field>
        </div>
      </div>

      {isEdit && (
        <div className="panel p-6 space-y-4">
          <SectionHead n="02" title="Status" />
          <div className="flex flex-col sm:flex-row gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => set("status", s.value)}
                className={`flex-1 min-h-[44px] rounded border px-3 py-2 text-sm transition ${
                  form.status === s.value ? "bg-ink text-paper border-ink" : "border-hair text-ink-sub hover:border-ink hover:text-ink"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEdit && (
        <div className="panel p-6 space-y-4">
          <SectionHead n="03" title="Teams" />
          <div className="space-y-2">
            {existing.data?.teams?.length ? existing.data.teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-2 rounded border border-hair px-3 py-2">
                <span className="text-sm text-ink">{team.name}</span>
                <button
                  type="button"
                  onClick={() => removeTeam.mutate(team.id)}
                  disabled={removeTeam.isPending}
                  className="flex h-8 w-8 items-center justify-center text-ink-faint hover:text-red-500 transition"
                  aria-label="Remove team"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )) : (
              <div className="text-sm text-ink-sub">No teams added yet.</div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 min-h-[44px]"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <button
              type="button"
              className="btn-secondary min-h-[44px]"
              disabled={!newTeamName.trim() || addTeam.isPending}
              onClick={() => { addTeam.mutate({ name: newTeamName.trim() }, { onSuccess: () => setNewTeamName("") }); }}
            >
              Add team
            </button>
          </div>
        </div>
      )}

      {err && <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost min-h-[44px]" onClick={() => navigate(-1)}>Cancel</button>
        <button type="submit" className="btn-accent min-h-[44px]" disabled={busy}>
          {busy ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create tournament →"}
        </button>
      </div>
    </form>
  );
}
