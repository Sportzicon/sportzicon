import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Radio, Edit2, Trophy, Info, Users, MapPin, Calendar, Award } from "lucide-react";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

// ─── Scorecard ────────────────────────────────────────────────────────────────

function ScorecardHeader({ match, innings }: { match: any; innings: any }) {
  const battingTeam = innings.batting_team_id === match.team1?.id ? match.team1 : match.team2;

  return (
    <div className="bg-gray-800 text-white rounded-t-xl p-4">
      <p className="text-gray-400 text-xs mb-1">Innings {innings.innings_number} · {battingTeam.name} batting</p>
      <div className="flex items-end justify-between">
        <div>
          <span className="text-4xl font-bold">{innings.total_runs}/{innings.total_wickets}</span>
          <span className="text-gray-400 ml-3 text-lg">({oversFromBalls(innings.total_balls)} Ov)</span>
        </div>
        {innings.target && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Target</p>
            <p className="text-2xl font-bold">{innings.target}</p>
            <p className="text-xs text-gray-400">
              Need {innings.target - innings.total_runs} in{" "}
              {(() => {
                const maxOvers = match?.format === "T20" ? 20 : match?.format === "ODI" ? 50 : match?.format === "T10" ? 10 : match?.tournament?.overs_per_innings ?? null;
                return maxOvers ? Math.max(0, Math.floor((maxOvers * 6 - innings.total_balls) / 6)) : "?";
              })()} ov
            </p>
          </div>
        )}
      </div>
      {innings.is_completed && (
        <p className="text-gray-400 text-sm mt-1">
          Innings complete · Extras: {innings.extras} (W:{innings.wides} NB:{innings.no_balls} B:{innings.byes} LB:{innings.leg_byes})
        </p>
      )}
    </div>
  );
}

function BattingTable({ entries, match }: { entries: any[]; match: any }) {
  const safeEntries = entries ?? [];
  const batted = safeEntries.filter((e: any) => e.status !== "yet_to_bat");
  const dnb = safeEntries.filter((e: any) => e.status === "yet_to_bat");

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Batter</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">R</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">B</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">4s</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">6s</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">SR</th>
          </tr>
        </thead>
        <tbody>
          {batted.map((e: any) => {
            const sr = e.balls_faced > 0 ? ((e.runs / e.balls_faced) * 100).toFixed(1) : "-";
            const isOut = e.status === "out";
            return (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-1">
                    <Link to={`/players/${e.player.id}`} className="font-medium hover:text-emerald-600 transition-colors">
                      {e.player.name}
                    </Link>
                    {e.player.is_captain && <span className="text-xs text-gray-400">(c)</span>}
                    {e.player.is_keeper && <span className="text-xs text-gray-400">(wk)</span>}
                  </div>
                  {isOut ? (
                    <p className="text-xs text-gray-400">
                      {e.dismissal_type?.replace("_", " ")}
                      {e.dismissal_desc ? ` · ${e.dismissal_desc}` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-600">not out</p>
                  )}
                </td>
                <td className="py-2.5 px-3 text-center font-bold">{e.runs}</td>
                <td className="py-2.5 px-3 text-center text-gray-500">{e.balls_faced}</td>
                <td className="py-2.5 px-3 text-center">{e.fours}</td>
                <td className="py-2.5 px-3 text-center">{e.sixes}</td>
                <td className="py-2.5 px-3 text-center text-gray-500">{sr}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {dnb.length > 0 && (
        <p className="text-xs text-gray-400 px-3 py-2">
          DNB: {dnb.map((e: any) => e.player.name).join(", ")}
        </p>
      )}
    </div>
  );
}

function BowlingTable({ entries }: { entries: any[] }) {
  const bowled = (entries ?? []).filter((e: any) => e.balls > 0);
  if (!bowled.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Bowler</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">O</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">M</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">R</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">W</th>
            <th className="text-center py-2 px-3 text-xs font-medium text-gray-500">Eco</th>
          </tr>
        </thead>
        <tbody>
          {bowled.map((e: any) => {
            const overs = `${Math.floor(e.balls / 6)}.${e.balls % 6}`;
            const eco = e.balls > 0 ? ((e.runs_conceded / e.balls) * 6).toFixed(2) : "-";
            return (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="py-2.5 px-3">
                  <Link to={`/players/${e.player.id}`} className="font-medium hover:text-emerald-600 transition-colors">
                    {e.player.name}
                  </Link>
                </td>
                <td className="py-2.5 px-3 text-center">{overs}</td>
                <td className="py-2.5 px-3 text-center text-gray-500">{e.maidens}</td>
                <td className="py-2.5 px-3 text-center">{e.runs_conceded}</td>
                <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{e.wickets}</td>
                <td className="py-2.5 px-3 text-center text-gray-500">{eco}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GenericScore({ match }: { match: any }) {
  const md: any = match.match_data || {};
  const events = match.events || [];

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 text-white rounded-xl p-6">
        <div className="grid grid-cols-3 items-center text-center">
          <div>
            <p className="font-bold text-lg">{match.team1?.name ?? "TBD"}</p>
            <p className="text-4xl font-bold mt-1">{md.team1_score ?? 0}</p>
          </div>
          <div className="text-gray-400 text-sm">vs</div>
          <div>
            <p className="font-bold text-lg">{match.team2?.name ?? "TBD"}</p>
            <p className="text-4xl font-bold mt-1">{md.team2_score ?? 0}</p>
          </div>
        </div>
      </div>
      {events.length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold mb-3">Match Events</h3>
          <div className="space-y-2">
            {events.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 text-sm">
                {ev.minute !== null && <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">{ev.minute}'</span>}
                <span className="capitalize text-gray-600">{ev.event_type.replace("_", " ")}</span>
                {ev.description && <span className="text-gray-400">{ev.description}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Playing XI Tab ───────────────────────────────────────────────────────────

function PlayingXITab({ matchId, match }: { matchId: string; match: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["match-xi", matchId],
    queryFn: () => api.get(`/matches/${matchId}/xi`).then(r => r.data)
  });

  if (isLoading) return <div className="animate-pulse space-y-3"><div className="h-48 bg-gray-100 rounded-xl" /></div>;

  const renderTeam = (team: any) => {
    const players: any[] = team?.players ?? [];
    const xiIds = new Set(players.filter((p: any) => p.in_xi).map((p: any) => p.id));
    const xiPlayers = players.filter((p: any) => p.in_xi);
    const benchPlayers = players.filter((p: any) => !p.in_xi);
    const hasXI = xiPlayers.length > 0;

    return (
      <div className="card overflow-hidden">
        {/* Team header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          {team?.logo_url ? (
            <img src={team.logo_url} className="w-8 h-8 rounded-full object-cover" alt="" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
              {(team?.short_name || team?.name || "?").charAt(0)}
            </div>
          )}
          <div>
            <p className="font-semibold">{team?.name}</p>
            {team?.short_name && <p className="text-xs text-gray-400">{team.short_name}</p>}
          </div>
        </div>

        {/* Playing XI */}
        {hasXI ? (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1">Playing XI</p>
            {xiPlayers.map((p: any, idx: number) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-300 w-5 text-right shrink-0">{idx + 1}</span>
                {p.jersey_number && (
                  <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded w-8 text-center shrink-0">
                    #{p.jersey_number}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/players/${p.id}`} className="font-medium text-sm hover:text-emerald-600 transition-colors">
                      {p.name}
                    </Link>
                    {p.is_captain && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-medium">C</span>
                    )}
                    {p.is_keeper && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">WK</span>
                    )}
                  </div>
                  {(p.role || p.batting_style || p.bowling_style) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[p.role, p.batting_style].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Bench / squad */}
            {benchPlayers.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-4 pt-3 pb-1 border-t border-gray-100">Squad (not playing)</p>
                {benchPlayers.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 opacity-50">
                    {p.jersey_number && (
                      <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded w-8 text-center shrink-0">
                        #{p.jersey_number}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link to={`/players/${p.id}`} className="text-sm font-medium hover:text-emerald-600">{p.name}</Link>
                      {p.role && <p className="text-xs text-gray-400">{p.role}</p>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 text-sm">
            Playing XI not yet announced.
            {players.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-300 mb-2">Full squad ({players.length} players)</p>
                {players.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-left px-4">
                    {p.jersey_number && <span className="text-xs text-gray-300 w-8">#{p.jersey_number}</span>}
                    <span className="text-sm">{p.name}</span>
                    {p.is_captain && <span className="text-xs text-yellow-600">(c)</span>}
                    {p.is_keeper && <span className="text-xs text-blue-600">(wk)</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {data?.xi_locked && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-700 flex items-center gap-2">
          <Award className="w-4 h-4" />
          Playing XI locked — match underway
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {renderTeam(data?.team1 ?? match?.team1)}
        {renderTeam(data?.team2 ?? match?.team2)}
      </div>
    </div>
  );
}

// ─── About Match Tab ──────────────────────────────────────────────────────────

function AboutTab({ match }: { match: any }) {
  const t = match.tournament ?? {};

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
        <span className="text-sm text-gray-400 w-36 shrink-0">{label}</span>
        <span className="text-sm font-medium flex-1">{value}</span>
      </div>
    );
  };

  const tossTeam = match.toss_winner_id === match.team1?.id ? match.team1?.name : match.toss_winner_id === match.team2?.id ? match.team2?.name : null;

  return (
    <div className="space-y-4">
      {/* Match details */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" /> Match Details
        </h3>
        <InfoRow label="Match" value={match.title ?? (match.match_number ? `Match #${match.match_number}` : null)} />
        <InfoRow label="Format" value={match.format ?? t.format} />
        <InfoRow label="Match Type" value={match.match_type ? match.match_type.charAt(0).toUpperCase() + match.match_type.slice(1) : null} />
        <InfoRow label="Sport" value={match.sport ? match.sport.charAt(0).toUpperCase() + match.sport.slice(1) : null} />
        <InfoRow label="Status" value={match.status ? match.status.charAt(0).toUpperCase() + match.status.slice(1) : null} />
        {match.result_summary && (
          <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-400 w-36 shrink-0">Result</span>
            <span className="text-sm font-semibold text-emerald-600 flex-1">{match.result_summary}</span>
          </div>
        )}
      </div>

      {/* Venue & schedule */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Venue & Schedule
        </h3>
        <InfoRow label="Venue" value={match.venue} />
        <InfoRow label="Location" value={t.location} />
        {match.scheduled_at && (
          <div className="flex gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <span className="text-sm text-gray-400 w-36 shrink-0">Date & Time</span>
            <span className="text-sm font-medium flex-1">
              {new Date(match.scheduled_at).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" at "}
              {new Date(match.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>

      {/* Toss */}
      {tossTeam && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Award className="w-4 h-4" /> Toss
          </h3>
          <InfoRow label="Toss won by" value={tossTeam} />
          <InfoRow label="Decision" value={match.toss_decision ? `Elected to ${match.toss_decision}` : null} />
        </div>
      )}

      {/* Tournament */}
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Tournament
        </h3>
        <div className="flex gap-3 py-2.5 border-b border-gray-50">
          <span className="text-sm text-gray-400 w-36 shrink-0">Name</span>
          <Link to={`/tournaments/${t.id}`} className="text-sm font-medium text-emerald-600 hover:underline flex-1">{t.name}</Link>
        </div>
        <InfoRow label="Season" value={t.season} />
        <InfoRow label="Ball Type" value={t.ball_type ? t.ball_type.charAt(0).toUpperCase() + t.ball_type.slice(1) + " ball" : null} />
      </div>

      {/* Match officials */}
      {(match.umpire1 || match.umpire2 || match.tv_umpire || match.match_referee) && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" /> Match Officials
          </h3>
          <InfoRow label="Umpire 1" value={match.umpire1} />
          <InfoRow label="Umpire 2" value={match.umpire2} />
          <InfoRow label="TV Umpire" value={match.tv_umpire} />
          <InfoRow label="Match Referee" value={match.match_referee} />
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "scorecard" | "xi" | "about";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);
  const [activeTab, setActiveTab] = useState<Tab>("scorecard");

  const { data, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: (query) => query.state.data?.status === "live" ? 10_000 : false
  });

  if (isLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  );
  if (!data) return <div className="text-center py-20 text-gray-400">Match not found.</div>;

  const isCricket = data.sport === "cricket";

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "scorecard", label: "Scorecard", icon: <Trophy className="w-3.5 h-3.5" /> },
    { id: "xi", label: "Playing XI", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "about", label: "About", icon: <Info className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Match header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={`/tournaments/${data.tournament_id}`} className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" /> {data.tournament?.name ?? "Tournament"}
        </Link>
        <span className="text-gray-300">›</span>
        <h1 className="font-bold">{data.title || `${data.team1?.name ?? "TBD"} vs ${data.team2?.name ?? "TBD"}`}</h1>
        {data.status === "live" && <span className="badge-live flex items-center gap-1"><Radio className="w-3 h-3" /> LIVE</span>}
        <div className="ml-auto flex items-center gap-2">
          {canManage && data.status === "live" && (
            <Link to={`/matches/${matchId}/score`} className="btn-primary">
              <Radio className="w-4 h-4" /> Score Match
            </Link>
          )}
          {canManage && data.status !== "live" && data.status !== "completed" && (
            <Link to={`/matches/${matchId}/score`} className="btn-secondary">
              <Edit2 className="w-4 h-4" /> Manage
            </Link>
          )}
          {canManage && (
            <Link to={`/matches/${matchId}/config`} className="btn-secondary text-sm">
              Config
            </Link>
          )}
        </div>
      </div>

      {/* Toss quick info (always visible above tabs) */}
      {data.toss_winner_id && (
        <p className="text-sm text-gray-500">
          Toss: {data.toss_winner_id === data.team1?.id ? data.team1?.name : data.team2?.name} won and chose to {data.toss_decision}
        </p>
      )}

      {/* Result banner */}
      {data.result_summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm font-medium text-emerald-700">
          {data.result_summary}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.id
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "scorecard" && (
        isCricket && (data.innings?.length ?? 0) > 0 ? (
          <div className="space-y-4">
            {data.innings.map((inn: any) => (
              <div key={inn.id} className="card overflow-hidden">
                <ScorecardHeader match={data} innings={inn} />
                <div className="p-0">
                  <div className="px-4 pt-4">
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Batting</h3>
                  </div>
                  <BattingTable entries={inn.batting_entries} match={data} />
                  <div className="px-4 pt-4">
                    <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wide mb-2">Bowling</h3>
                  </div>
                  <BowlingTable entries={inn.bowling_entries} />
                </div>
              </div>
            ))}
          </div>
        ) : !isCricket ? (
          <GenericScore match={data} />
        ) : (
          <div className="card p-8 text-center text-gray-400">
            {data.status === "upcoming" ? "Match hasn't started yet." : "No scorecard data yet."}
            {canManage && data.status !== "completed" && (
              <div className="mt-3">
                <Link to={`/matches/${matchId}/score`} className="btn-primary mx-auto">Start Scoring</Link>
              </div>
            )}
          </div>
        )
      )}

      {activeTab === "xi" && (
        <PlayingXITab matchId={matchId!} match={data} />
      )}

      {activeTab === "about" && (
        <AboutTab match={data} />
      )}
    </div>
  );
}
