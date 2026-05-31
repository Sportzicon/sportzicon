import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Radio, Edit2, Trophy } from "lucide-react";

function oversFromBalls(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function ScorecardHeader({ match, innings }: { match: any; innings: any }) {
  const battingTeam = innings.batting_team_id === match.team1.id ? match.team1 : match.team2;
  const bowlingTeam = innings.batting_team_id === match.team1.id ? match.team2 : match.team1;

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
            <p className="text-xs text-gray-400">Need {innings.target - innings.total_runs} in {Math.floor((50 * 6 - innings.total_balls) / 6)} ov</p>
          </div>
        )}
      </div>
      {innings.is_completed && <p className="text-gray-400 text-sm mt-1">Innings complete · Extras: {innings.extras} (W:{innings.wides} NB:{innings.no_balls} B:{innings.byes} LB:{innings.leg_byes})</p>}
    </div>
  );
}

function BattingTable({ entries, match }: { entries: any[]; match: any }) {
  const batted = entries.filter((e: any) => e.status !== "yet_to_bat");
  const dnb = entries.filter((e: any) => e.status === "yet_to_bat");

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
  const bowled = entries.filter((e: any) => e.balls > 0);
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
      {/* Score display */}
      <div className="bg-gray-800 text-white rounded-xl p-6">
        <div className="grid grid-cols-3 items-center text-center">
          <div>
            <p className="font-bold text-lg">{match.team1.name}</p>
            <p className="text-4xl font-bold mt-1">{md.team1_score ?? 0}</p>
          </div>
          <div className="text-gray-400 text-sm">vs</div>
          <div>
            <p className="font-bold text-lg">{match.team2.name}</p>
            <p className="text-4xl font-bold mt-1">{md.team2_score ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Events timeline */}
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

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const user = useAuthStore(s => s.user);
  const canManage = user && ["organizer", "admin", "scorer"].includes(user.role);

  const { data, isLoading } = useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api.get(`/matches/${matchId}`).then(r => r.data.match),
    refetchInterval: (query) => query.state.data?.status === "live" ? 10_000 : false
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-48 bg-gray-100 rounded-xl" /><div className="h-64 bg-gray-100 rounded-xl" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Match not found.</div>;

  const isCricket = data.sport === "cricket";

  return (
    <div className="space-y-4">
      {/* Match header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to={`/tournaments/${data.tournament_id}`} className="text-sm text-emerald-600 hover:underline flex items-center gap-1">
          <Trophy className="w-3.5 h-3.5" /> Tournament
        </Link>
        <span className="text-gray-300">›</span>
        <h1 className="font-bold">{data.title || `${data.team1.name} vs ${data.team2.name}`}</h1>
        {data.status === "live" && <span className="badge-live flex items-center gap-1"><Radio className="w-3 h-3" /> LIVE</span>}
        {canManage && data.status === "live" && (
          <Link to={`/matches/${matchId}/score`} className="btn-primary ml-auto">
            <Radio className="w-4 h-4" /> Score Match
          </Link>
        )}
        {canManage && data.status !== "live" && data.status !== "completed" && (
          <Link to={`/matches/${matchId}/score`} className="btn-secondary ml-auto">
            <Edit2 className="w-4 h-4" /> Manage
          </Link>
        )}
      </div>

      {/* Toss info */}
      {data.toss_winner_id && (
        <p className="text-sm text-gray-500">
          Toss: {data.toss_winner_id === data.team1.id ? data.team1.name : data.team2.name} won and chose to {data.toss_decision}
        </p>
      )}

      {/* Result */}
      {data.result_summary && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm font-medium text-emerald-700">
          {data.result_summary}
        </div>
      )}

      {/* Cricket scorecard */}
      {isCricket && data.innings.length > 0 ? (
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
      )}
    </div>
  );
}
