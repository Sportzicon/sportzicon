import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { scoringApi } from "../../api/scoringClient";
import { useAuthStore } from "../../store/auth";
import {
  Trophy, Users, Calendar, MapPin, Radio, Edit2, ChevronRight,
  Plus, ChevronDown, ChevronUp, Trash2, User
} from "lucide-react";

const ov = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

const MATCH_TYPES = ["league", "tournament", "friendly", "trial", "academy", "knockout"];
const ROLES = ["batsman", "bowler", "all-rounder", "wicket-keeper"];
const BAT_STYLES = ["right-hand bat", "left-hand bat"];
const BOWL_STYLES = [
  "right-arm fast", "right-arm fast-medium", "right-arm medium-fast", "right-arm medium",
  "right-arm off-spin", "right-arm leg-spin",
  "left-arm fast", "left-arm fast-medium", "left-arm medium",
  "left-arm orthodox", "left-arm wrist-spin",
  "slow left-arm orthodox", "other"
];
const WICKET_TYPES = ["bowled","caught","lbw","run_out","stumped","hit_wicket","handled_ball","obstructing_field","retired_hurt"];

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    ongoing: "bg-red-100 text-red-600", live: "bg-red-100 text-red-600",
    upcoming: "bg-amber-100 text-amber-700",
    completed: "bg-fill2 text-ink-sub"
  };
  return <span className={`lab px-2 py-0.5 rounded-full ${map[status] ?? "bg-fill text-ink-sub"}`}>{status.toUpperCase()}</span>;
}

// ── Match row ─────────────────────────────────────────────────────────────────
function MatchRow({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const t1   = match.team1; const t2 = match.team2;
  return (
    <Link to={`/scoring/matches/${match.id}`} className="flex items-center gap-3 p-3 rounded hover:bg-fill transition-colors group">
      <div className="w-7 h-7 rounded-full bg-fill flex items-center justify-center lab text-ink-faint shrink-0">
        {match.match_number ?? "–"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="font-semibold text-ink">{t1?.short_name || t1?.name || "TBD"}</span>
          {inn1 && <span className="font-mononum text-ink">{inn1.total_runs}/{inn1.total_wickets} <span className="text-ink-faint text-xs">({ov(inn1.total_balls)})</span></span>}
          <span className="text-ink-faint">vs</span>
          <span className="font-semibold text-ink">{t2?.short_name || t2?.name || "TBD"}</span>
          {inn2 && <span className="font-mononum text-ink">{inn2.total_runs}/{inn2.total_wickets} <span className="text-ink-faint text-xs">({ov(inn2.total_balls)})</span></span>}
        </div>
        {match.venue && <p className="lab text-ink-faint mt-0.5">{match.venue}</p>}
        {match.result_summary && <p className="lab text-brand-500 mt-0.5">{match.result_summary}</p>}
        {match.toss_winner_id && !match.result_summary && (
          <p className="lab text-ink-faint mt-0.5">
            Toss: {match.toss_winner_id === t1?.id ? t1?.name : t2?.name} won · elected to {match.toss_decision}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusPill status={match.status} />
        <ChevronRight className="w-4 h-4 text-ink-faint group-hover:text-ink" />
      </div>
    </Link>
  );
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({ player, tournamentId, teamId, canManage, onDeleted }: any) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => scoringApi.delete(`/tournaments/${tournamentId}/teams/${teamId}/players/${player.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scoring-tournament", tournamentId] }); onDeleted?.(); }
  });
  const roleColor: Record<string, string> = {
    "batsman": "text-blue-600", "bowler": "text-purple-600",
    "all-rounder": "text-brand-500", "wicket-keeper": "text-amber-600"
  };
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded hover:bg-fill group">
      <div className="w-7 h-7 rounded-full bg-fill flex items-center justify-center shrink-0">
        {player.jersey_number
          ? <span className="font-mononum text-xs font-bold text-ink">{player.jersey_number}</span>
          : <User className="w-3.5 h-3.5 text-ink-faint" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">
          {player.name}
          {player.is_captain && <span className="text-brand-500"> (c)</span>}
          {player.is_keeper && <span className="text-ink-sub"> †</span>}
        </p>
        <p className={`lab ${roleColor[player.role] ?? "text-ink-faint"}`}>
          {player.role?.replace(/-/g, " ")}
          {player.batting_style && <span className="text-ink-faint"> · {player.batting_style}</span>}
        </p>
      </div>
      {canManage && (
        <button onClick={() => del.mutate()} disabled={del.isPending}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-ink-faint hover:text-red-500 transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Add player form ───────────────────────────────────────────────────────────
function AddPlayerForm({ tournamentId, teamId, onDone }: any) {
  const qc  = useQueryClient();
  const [f, setF] = useState({
    name: "", role: "batsman", batting_style: "right-hand bat", bowling_style: "",
    jersey_number: "", is_captain: false, is_keeper: false
  });
  const mut = useMutation({
    mutationFn: () => scoringApi.post(`/tournaments/${tournamentId}/teams/${teamId}/players`, {
      ...f, jersey_number: f.jersey_number ? Number(f.jersey_number) : undefined
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scoring-tournament", tournamentId] });
      setF({ name:"", role:"batsman", batting_style:"right-hand bat", bowling_style:"", jersey_number:"", is_captain:false, is_keeper:false });
      onDone?.();
    }
  });
  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  const isBowler = f.role === "bowler" || f.role === "all-rounder";

  return (
    <div className="bg-fill rounded p-4 space-y-3 border border-hairsoft">
      <p className="lab text-ink-sub">Add Player</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="lab block mb-1">Full Name *</label>
          <input className="input w-full" value={f.name} onChange={e => s("name", e.target.value)} placeholder="e.g. Rohit Sharma" required />
        </div>
        <div>
          <label className="lab block mb-1">Jersey #</label>
          <input className="input w-full" type="number" value={f.jersey_number} onChange={e => s("jersey_number", e.target.value)} placeholder="e.g. 45" />
        </div>
        <div>
          <label className="lab block mb-1">Role</label>
          <select className="input w-full" value={f.role} onChange={e => s("role", e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r.replace(/-/g," ")}</option>)}
          </select>
        </div>
        <div>
          <label className="lab block mb-1">Batting Style</label>
          <select className="input w-full" value={f.batting_style} onChange={e => s("batting_style", e.target.value)}>
            {BAT_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {isBowler && (
          <div>
            <label className="lab block mb-1">Bowling Style</label>
            <select className="input w-full" value={f.bowling_style} onChange={e => s("bowling_style", e.target.value)}>
              <option value="">Select style</option>
              {BOWL_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        {f.role === "wicket-keeper" && (
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" id="is_keeper" checked={f.is_keeper} onChange={e => s("is_keeper", e.target.checked)} />
            <label htmlFor="is_keeper" className="text-sm text-ink">Wicket-keeper</label>
          </div>
        )}
        <div className="sm:col-span-2 flex items-center gap-2">
          <input type="checkbox" id="is_captain" checked={f.is_captain} onChange={e => s("is_captain", e.target.checked)} />
          <label htmlFor="is_captain" className="text-sm text-ink">Team Captain</label>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => f.name && mut.mutate()} disabled={!f.name || mut.isPending} className="btn-primary text-xs min-h-0 px-4 py-2">
          {mut.isPending ? "Adding…" : "Add Player"}
        </button>
        <button onClick={onDone} className="btn-secondary text-xs min-h-0 px-4 py-2">Cancel</button>
      </div>
      {mut.isError && <p className="text-xs text-red-600">{(mut.error as any)?.response?.data?.error?.message || "Failed"}</p>}
    </div>
  );
}

// ── Team panel ────────────────────────────────────────────────────────────────
function TeamPanel({ team, tournamentId, canManage }: any) {
  const [expanded, setExpanded]     = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const qc = useQueryClient();
  const delTeam = useMutation({
    mutationFn: () => scoringApi.delete(`/tournaments/${tournamentId}/teams/${team.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring-tournament", tournamentId] })
  });
  const players = team.players ?? [];
  const roleOrder: Record<string, number> = { "batsman":0, "wicket-keeper":1, "all-rounder":2, "bowler":3 };
  const sorted = [...players].sort((a, b) => (roleOrder[a.role]??4) - (roleOrder[b.role]??4));

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 hover:bg-fill transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-disp font-bold text-sm text-white"
          style={{ backgroundColor: team.color || "#14110D" }}>
          {(team.short_name || team.name).charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink">{team.name}</p>
          <p className="lab text-ink-faint">{players.length} players</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <button onClick={e => { e.stopPropagation(); if (confirm(`Delete team "${team.name}"?`)) delTeam.mutate(); }}
              className="p-1 rounded hover:bg-red-50 text-ink-faint hover:text-red-500 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-hairsoft">
          {sorted.length === 0 && !addingPlayer && (
            <p className="lab text-ink-faint px-4 py-3 text-center">No players yet</p>
          )}
          <div className="divide-y divide-hairsoft">
            {sorted.map(p => (
              <PlayerRow key={p.id} player={p} tournamentId={tournamentId} teamId={team.id} canManage={canManage} />
            ))}
          </div>

          {addingPlayer ? (
            <div className="p-3">
              <AddPlayerForm tournamentId={tournamentId} teamId={team.id} onDone={() => setAddingPlayer(false)} />
            </div>
          ) : canManage ? (
            <div className="p-3">
              <button onClick={() => setAddingPlayer(true)} className="btn-secondary text-xs min-h-0 px-3 py-1.5 gap-1 w-full justify-center">
                <Plus className="w-3.5 h-3.5" /> Add Player
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ── Schedule match form ───────────────────────────────────────────────────────
function ScheduleMatchForm({ tournament, onDone }: { tournament: any; onDone: () => void }) {
  const qc = useQueryClient();
  const teams = tournament.teams ?? [];
  const [f, setF] = useState({
    team1_id: teams[0]?.id ?? "", team2_id: teams[1]?.id ?? "",
    title: "", venue: tournament.location ?? "",
    match_number: String((tournament.matches?.length ?? 0) + 1),
    toss_winner_id: "", toss_decision: "bat",
    format: tournament.format ?? "T20",
    match_type: tournament.match_type ?? "league",
    scheduled_at: ""
  });

  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: async () => {
      const { data } = await scoringApi.post(`/tournaments/${tournament.id}/matches`, {
        team1_id: f.team1_id, team2_id: f.team2_id,
        title: f.title || undefined,
        venue: f.venue || undefined,
        match_number: f.match_number ? Number(f.match_number) : undefined,
        format: f.format || undefined,
        match_type: f.match_type || undefined,
        scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : undefined
      });
      const matchId = data.match?.id || data.id;
      // Set toss if selected
      if (f.toss_winner_id && matchId) {
        await scoringApi.put(`/matches/${matchId}`, {
          toss_winner_id: f.toss_winner_id,
          toss_decision: f.toss_decision,
          match_type: f.match_type || undefined,
          status: "upcoming"
        });
      }
      return matchId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scoring-tournament", tournament.id] });
      onDone();
    }
  });

  const t1 = teams.find((t: any) => t.id === f.team1_id);
  const t2 = teams.find((t: any) => t.id === f.team2_id);

  return (
    <div className="card p-5 space-y-5 border-2 border-brand-500">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">Schedule Match</p>
        <button onClick={onDone} className="lab text-ink-faint hover:text-ink">✕</button>
      </div>

      {/* Teams */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="lab block mb-1">Team 1 *</label>
          <select className="input w-full" value={f.team1_id} onChange={e => s("team1_id", e.target.value)} required>
            <option value="">Select team</option>
            {teams.filter((t: any) => t.id !== f.team2_id).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lab block mb-1">Team 2 *</label>
          <select className="input w-full" value={f.team2_id} onChange={e => s("team2_id", e.target.value)} required>
            <option value="">Select team</option>
            {teams.filter((t: any) => t.id !== f.team1_id).map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toss */}
      {f.team1_id && f.team2_id && (
        <div className="panel p-4 space-y-3 bg-fill/50">
          <p className="lab text-ink-sub">Toss Result</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="lab block mb-2">Toss won by</label>
              <div className="flex gap-2">
                {[t1, t2].filter(Boolean).map((t: any) => (
                  <button key={t.id} type="button"
                    onClick={() => s("toss_winner_id", t.id)}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition ${
                      f.toss_winner_id === t.id ? "bg-ink text-paper border-ink" : "bg-panel border-hair text-ink-sub hover:border-ink"
                    }`}>
                    {t.short_name || t.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="lab block mb-2">Elected to</label>
              <div className="flex gap-2">
                {["bat", "bowl"].map(d => (
                  <button key={d} type="button"
                    onClick={() => s("toss_decision", d)}
                    className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition capitalize ${
                      f.toss_decision === d ? "bg-ink text-paper border-ink" : "bg-panel border-hair text-ink-sub hover:border-ink"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {f.toss_winner_id && (
            <p className="lab text-brand-500">
              {teams.find((t: any) => t.id === f.toss_winner_id)?.name} won the toss and elected to {f.toss_decision} first
            </p>
          )}
        </div>
      )}

      {/* Match details */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="lab block mb-1">Match # </label>
          <input className="input w-full" type="number" value={f.match_number} onChange={e => s("match_number", e.target.value)} />
        </div>
        <div>
          <label className="lab block mb-1">Format</label>
          <input className="input w-full" value={f.format} onChange={e => s("format", e.target.value)} placeholder="T20, ODI, Test, T10…" />
        </div>
        <div>
          <label className="lab block mb-1">Match Type</label>
          <select className="input w-full" value={f.match_type} onChange={e => s("match_type", e.target.value)}>
            {MATCH_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="lab block mb-1">Title (optional)</label>
          <input className="input w-full" value={f.title} onChange={e => s("title", e.target.value)} placeholder="e.g. Semi-Final" />
        </div>
        <div>
          <label className="lab block mb-1">Venue</label>
          <input className="input w-full" value={f.venue} onChange={e => s("venue", e.target.value)} placeholder="Stadium, City" />
        </div>
        <div className="sm:col-span-2">
          <label className="lab block mb-1">Scheduled date & time</label>
          <input className="input w-full" type="datetime-local" value={f.scheduled_at} onChange={e => s("scheduled_at", e.target.value)} />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          disabled={!f.team1_id || !f.team2_id || mut.isPending}
          onClick={() => mut.mutate()}
          className="btn-primary text-sm"
        >
          {mut.isPending ? "Scheduling…" : "Schedule Match"}
        </button>
        <button onClick={onDone} className="btn-secondary text-sm">Cancel</button>
      </div>
      {mut.isError && (
        <p className="text-xs text-red-600">{(mut.error as any)?.response?.data?.error?.message || "Failed to schedule match"}</p>
      )}
    </div>
  );
}

// ── Add team form ─────────────────────────────────────────────────────────────
function AddTeamForm({ tournamentId, onDone }: { tournamentId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", short_name: "", color: "#14110D" });
  const mut = useMutation({
    mutationFn: () => scoringApi.post(`/tournaments/${tournamentId}/teams`, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scoring-tournament", tournamentId] }); onDone(); }
  });

  return (
    <div className="card p-4 space-y-3 border-2 border-brand-500">
      <p className="lab text-ink-sub">New Team</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="lab block mb-1">Team Name *</label>
          <input className="input w-full" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mumbai Lions" required />
        </div>
        <div>
          <label className="lab block mb-1">Short Name</label>
          <input className="input w-full" maxLength={5} value={f.short_name} onChange={e => setF(p => ({ ...p, short_name: e.target.value.toUpperCase() }))} placeholder="e.g. MUL" />
        </div>
        <div>
          <label className="lab block mb-1">Team Color</label>
          <input type="color" className="w-full h-9 rounded border border-hair cursor-pointer" value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => f.name && mut.mutate()} disabled={!f.name || mut.isPending} className="btn-primary text-xs min-h-0 px-4 py-2">
          {mut.isPending ? "Adding…" : "Add Team"}
        </button>
        <button onClick={onDone} className="btn-secondary text-xs min-h-0 px-4 py-2">Cancel</button>
      </div>
      {mut.isError && <p className="text-xs text-red-600">{(mut.error as any)?.response?.data?.error?.message || "Failed"}</p>}
    </div>
  );
}

// ── Standings ─────────────────────────────────────────────────────────────────
function StandingsTable({ tournamentId }: { tournamentId: string }) {
  const { data } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => scoringApi.get(`/tournaments/${tournamentId}/standings`).then(r => r.data)
  });
  const standings = data?.standings;
  const isCricket = data?.tournament?.sport === "cricket";
  if (!standings?.length) return <p className="lab text-ink-faint py-4 text-center">No matches played yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairsoft">
            {["#","Team","P","W","L","NR","Pts",...(isCricket?["NRR"]:[])].map(h => (
              <th key={h} className="lab text-ink-sub py-2 px-2 text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {standings.map((row: any, i: number) => (
            <tr key={row.team_id} className={`border-b border-hairsoft ${i < 2 ? "bg-brand-50/40" : ""}`}>
              <td className="lab text-ink-sub py-2 px-2">{i + 1}</td>
              <td className="py-2 px-2 font-medium text-ink">{row.short_name || row.team_name}</td>
              <td className="lab py-2 px-2">{row.played}</td>
              <td className="lab py-2 px-2 text-green-700 font-medium">{row.won}</td>
              <td className="lab py-2 px-2 text-red-500">{row.lost}</td>
              <td className="lab py-2 px-2">{row.no_result}</td>
              <td className="lab py-2 px-2 font-bold">{row.points}</td>
              {isCricket && <td className={`lab py-2 px-2 ${row.nrr >= 0 ? "text-green-700" : "text-red-500"}`}>{row.nrr >= 0 ? "+" : ""}{row.nrr}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function ScoringTournamentDetailInner() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = user?.role === "organizer" || user?.role === "admin" || user?.role === "scorer";

  const [addingTeam, setAddingTeam]   = useState(false);
  const [scheduling, setScheduling]   = useState(false);
  const [activeSection, setActiveSection] = useState<"matches"|"teams">("matches");

  const { data, isLoading } = useQuery({
    queryKey: ["scoring-tournament", id],
    queryFn: () => scoringApi.get(`/tournaments/${id}`).then(r => r.data.tournament),
    refetchInterval: 10_000
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="skel h-36 rounded" /><div className="skel h-64 rounded" />
    </div>
  );
  if (!data) return <div className="text-center py-20 text-ink-sub">Tournament not found.</div>;

  const teams   = data.teams ?? [];
  const matches = data.matches ?? [];
  const liveMatches     = matches.filter((m: any) => m.status === "live");
  const upcomingMatches = matches.filter((m: any) => m.status === "upcoming");
  const completedMatches= matches.filter((m: any) => m.status === "completed");

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header card */}
      <div className="card overflow-hidden">
        {data.banner_url && <img src={data.banner_url} className="w-full h-36 object-cover" alt="" />}
        <div className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded bg-fill flex items-center justify-center shrink-0">
              {data.logo_url
                ? <img src={data.logo_url} className="w-14 h-14 rounded object-cover" alt="" />
                : <Trophy className="w-7 h-7 text-brand-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-disp text-2xl text-ink">{data.name}</h1>
                <StatusPill status={data.status} />
              </div>
              <p className="text-ink-sub capitalize mt-0.5">{data.sport}{data.format ? ` · ${data.format}` : ""}</p>
              <div className="flex gap-4 mt-1.5 flex-wrap">
                {data.location && <span className="lab text-ink-faint flex items-center gap-1"><MapPin className="w-3 h-3" />{data.location}</span>}
                {data.start_date && <span className="lab text-ink-faint flex items-center gap-1"><Calendar className="w-3 h-3" />{data.start_date}{data.end_date ? ` – ${data.end_date}` : ""}</span>}
                <span className="lab text-ink-faint flex items-center gap-1"><Users className="w-3 h-3" />{teams.length} teams · {matches.length} matches</span>
              </div>
            </div>
            {canManage && (
              <Link to={`/scoring/tournaments/${id}/edit`} className="btn-secondary text-sm shrink-0 flex items-center gap-1 min-h-0 px-3 py-2">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Link>
            )}
          </div>
          {data.description && <p className="mt-3 text-sm text-ink-70">{data.description}</p>}
        </div>
      </div>

      {/* Action bar */}
      {canManage && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setAddingTeam(true); setActiveSection("teams"); }}
            className="btn-secondary text-sm gap-1 min-h-0 px-4 py-2">
            <Plus className="w-3.5 h-3.5" /> Add Team
          </button>
          {teams.length >= 2 && (
            <button onClick={() => { setScheduling(true); setActiveSection("matches"); }}
              className="btn-accent text-sm gap-1 min-h-0 px-4 py-2">
              <Radio className="w-3.5 h-3.5" /> Schedule Match
            </button>
          )}
          {teams.length < 2 && (
            <p className="lab text-ink-faint flex items-center">Add at least 2 teams to schedule a match</p>
          )}
        </div>
      )}

      {/* Schedule match form */}
      {scheduling && canManage && (
        <ScheduleMatchForm tournament={data} onDone={() => setScheduling(false)} />
      )}

      {/* Add team form */}
      {addingTeam && canManage && (
        <AddTeamForm tournamentId={id!} onDone={() => setAddingTeam(false)} />
      )}

      {/* Section tabs */}
      <div className="flex border-b border-hair">
        {(["matches", "teams"] as const).map(sec => (
          <button key={sec} onClick={() => setActiveSection(sec)}
            className={`px-5 py-2.5 lab transition-colors capitalize ${
              activeSection === sec
                ? "border-b-2 border-brand-500 text-brand-500"
                : "text-ink-sub hover:text-ink"
            }`}>
            {sec} {sec === "teams" ? `(${teams.length})` : `(${matches.length})`}
          </button>
        ))}
      </div>

      {/* MATCHES tab */}
      {activeSection === "matches" && (
        <div className="space-y-4">
          {liveMatches.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                <h2 className="font-semibold text-ink">Live</h2>
              </div>
              <div className="divide-y divide-hairsoft">{liveMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}</div>
            </div>
          )}
          {upcomingMatches.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-ink mb-2">Upcoming</h2>
              <div className="divide-y divide-hairsoft">{upcomingMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}</div>
            </div>
          )}
          {completedMatches.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-ink mb-2">Results</h2>
              <div className="divide-y divide-hairsoft">{completedMatches.map((m: any) => <MatchRow key={m.id} match={m} />)}</div>
            </div>
          )}
          {matches.length === 0 && !scheduling && (
            <div className="panel p-10 text-center">
              <p className="font-disp text-xl text-ink mb-1">No matches yet</p>
              {canManage && teams.length >= 2
                ? <button onClick={() => setScheduling(true)} className="btn-accent text-sm mt-3 gap-1"><Radio className="w-3.5 h-3.5" /> Schedule First Match</button>
                : <p className="lab text-ink-faint mt-2">Add at least 2 teams first</p>
              }
            </div>
          )}
          {/* Points table */}
          {matches.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-ink mb-3">Points Table</h2>
              <StandingsTable tournamentId={id!} />
            </div>
          )}
        </div>
      )}

      {/* TEAMS tab */}
      {activeSection === "teams" && (
        <div className="space-y-3">
          {teams.length === 0 && !addingTeam && (
            <div className="panel p-10 text-center">
              <p className="font-disp text-xl text-ink mb-1">No teams yet</p>
              {canManage && (
                <button onClick={() => setAddingTeam(true)} className="btn-primary text-sm mt-3 gap-1"><Plus className="w-3.5 h-3.5" /> Add First Team</button>
              )}
            </div>
          )}
          {teams.map((team: any) => (
            <TeamPanel key={team.id} team={team} tournamentId={id!} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScoringTournamentDetail() {
  return <ScoringTournamentDetailInner />;
}
