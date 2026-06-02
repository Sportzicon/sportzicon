import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { User, Target, Zap } from "lucide-react";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function PlayerStats() {
  const { playerId } = useParams<{ playerId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["player-stats", playerId],
    queryFn: () => api.get(`/scoring/players/${playerId}/stats`).then(r => r.data)
  });

  if (isLoading) return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-100 rounded-xl" /><div className="h-64 bg-gray-100 rounded-xl" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-400">Player not found.</div>;

  const { player, battingStats: bat, bowlingStats: bowl } = data;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Player card */}
      <div className="card p-6 flex items-center gap-4">
        {player.photo_url ? (
          <img src={player.photo_url} className="w-20 h-20 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <User className="w-10 h-10 text-emerald-400" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{player.name}</h1>
            {player.is_captain && <span className="badge bg-amber-100 text-amber-700">Captain</span>}
          </div>
          <p className="text-gray-500 capitalize mt-1">{player.role || "Player"}</p>
          {player.batting_style && <p className="text-sm text-gray-400">{player.batting_style}</p>}
          {player.bowling_style && <p className="text-sm text-gray-400">{player.bowling_style}</p>}
          {player.team && (
            <p className="text-sm text-emerald-600 mt-1 font-medium">{player.team.name}</p>
          )}
        </div>
      </div>

      {/* Batting stats */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-emerald-600" />
          <h2 className="font-semibold text-lg">Batting</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
          <StatBox label="Matches" value={bat.matches} />
          <StatBox label="Innings" value={bat.innings} />
          <StatBox label="Runs" value={bat.runs} />
          <StatBox label="Highest" value={bat.highest} />
          <StatBox label="Average" value={bat.average} />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <StatBox label="Strike Rate" value={bat.strike_rate} />
          <StatBox label="50s" value={bat.fifties} />
          <StatBox label="100s" value={bat.hundreds} />
          <StatBox label="4s" value={bat.fours} />
          <StatBox label="6s" value={bat.sixes} />
        </div>
      </div>

      {/* Bowling stats */}
      {bowl.innings > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-lg">Bowling</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-4">
            <StatBox label="Matches" value={bowl.matches} />
            <StatBox label="Innings" value={bowl.innings} />
            <StatBox label="Overs" value={bowl.overs} />
            <StatBox label="Wickets" value={bowl.wickets} />
            <StatBox label="Best" value={bowl.best} />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <StatBox label="Runs" value={bowl.runs} />
            <StatBox label="Economy" value={bowl.economy} />
            <StatBox label="Average" value={bowl.average || "-"} />
            <StatBox label="5-Wickets" value={bowl.five_wickets} />
          </div>
        </div>
      )}

      {bat.innings === 0 && bowl.innings === 0 && (
        <div className="card p-8 text-center text-gray-400">No match stats recorded yet.</div>
      )}
    </div>
  );
}
