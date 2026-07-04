import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scoringApi } from "../../../api/scoringClient";
import { queryKeys } from "../../../hooks/queryKeys";
import {
  Radio, Trophy, Calendar, MapPin, ChevronRight, Activity,
  Filter, RefreshCw
} from "lucide-react";

const ov = (b: number) => `${Math.floor(b / 6)}.${b % 6}`;

const STATUS_TABS = [
  { value: "all",       label: "All" },
  { value: "live",      label: "Live" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
];

const SPORTS = ["cricket", "football", "basketball", "hockey", "kabaddi", "volleyball"];

const STATUS_COLOR: Record<string, string> = {
  live:      "bg-red-100 text-red-600",
  upcoming:  "bg-amber-100 text-amber-700",
  completed: "bg-fill2 text-ink-sub",
  abandoned: "bg-gray-100 text-gray-500",
  no_result: "bg-gray-100 text-gray-500",
};

interface MatchPage {
  matches: any[];
  nextCursor: string | null;
}

function MatchCard({ match }: { match: any }) {
  const inn1 = match.innings?.find((i: any) => i.innings_number === 1);
  const inn2 = match.innings?.find((i: any) => i.innings_number === 2);
  const t1 = match.team1;
  const t2 = match.team2;
  const isLive = match.status === "live";

  return (
    <Link
      to={`/scoring/matches/${match.id}`}
      className="card block hover:shadow-md transition-shadow overflow-hidden"
    >
      {/* Tournament header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-fill border-b border-hair">
        <Trophy className="w-3 h-3 text-ink-faint shrink-0" />
        <span className="lab text-ink-sub truncate text-xs">
          {match.tournament?.name ?? "Unknown tournament"}
          {match.tournament?.format ? ` · ${match.tournament.format}` : ""}
          {match.tournament?.season ? ` ${match.tournament.season}` : ""}
        </span>
        {isLive ? (
          <span className="ml-auto flex items-center gap-1 lab font-bold text-red-600 shrink-0 text-[10px] animate-pulse">
            <Activity className="w-3 h-3" /> LIVE
          </span>
        ) : (
          <span className={`ml-auto lab px-1.5 py-0.5 rounded text-[10px] ${STATUS_COLOR[match.status] ?? "bg-fill text-ink-sub"}`}>
            {match.status.toUpperCase()}
          </span>
        )}
      </div>

      {/* Teams + scores */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {t1?.logo_url && <img src={t1.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />}
            <span className="text-sm font-semibold truncate text-ink">
              {t1?.name ?? "TBD"}
            </span>
          </div>
          {inn1 && (
            <span className="font-mononum font-bold text-ink whitespace-nowrap shrink-0">
              {inn1.total_runs}/{inn1.total_wickets}
              <span className="text-ink-faint font-normal text-xs ml-1">({ov(inn1.total_balls)})</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {t2?.logo_url && <img src={t2.logo_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />}
            <span className="text-sm font-semibold truncate text-ink">
              {t2?.name ?? "TBD"}
            </span>
          </div>
          {inn2 && (
            <span className="font-mononum font-bold text-ink whitespace-nowrap shrink-0">
              {inn2.total_runs}/{inn2.total_wickets}
              <span className="text-ink-faint font-normal text-xs ml-1">({ov(inn2.total_balls)})</span>
            </span>
          )}
        </div>

        {match.result_summary ? (
          <p className="lab text-brand-500 text-xs pt-1 border-t border-hairsoft">{match.result_summary}</p>
        ) : match.scheduled_at ? (
          <div className="flex items-center gap-3 pt-1 border-t border-hairsoft">
            <span className="lab text-ink-faint flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              {new Date(match.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {" · "}
              {new Date(match.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {match.venue && (
              <span className="lab text-ink-faint flex items-center gap-1 text-xs truncate">
                <MapPin className="w-3 h-3 shrink-0" />{match.venue}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end px-4 pb-2">
        <span className="lab text-brand-500 text-xs flex items-center gap-0.5">
          View scorecard <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default function ScoringAllMatches() {
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeSport, setActiveSport] = useState("");

  const { data, isLoading, isFetching, refetch, fetchNextPage, hasNextPage } =
    useInfiniteQuery<MatchPage>({
      queryKey: queryKeys.scoringAllMatches({ status: activeStatus, sport: activeSport }),
      queryFn: ({ pageParam }) =>
        scoringApi.get("/matches", {
          params: {
            status: activeStatus !== "all" ? activeStatus : undefined,
            sport:  activeSport || undefined,
            limit:  20,
            cursor: pageParam as string | undefined,
          },
        }).then(r => r.data as MatchPage),
      getNextPageParam: (last: MatchPage) => last.nextCursor ?? undefined,
      initialPageParam: undefined,
    });

  function changeTab(status: string) {
    setActiveStatus(status);
    setActiveSport("");
  }

  function changeSport(sport: string) {
    setActiveSport(prev => (prev === sport ? "" : sport));
  }

  const allMatches = data?.pages.flatMap(p => p.matches) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-disp font-bold text-xl text-ink flex items-center gap-2">
          <Radio className="w-5 h-5 text-brand-500" />
          All Matches
        </h1>
        <button
          onClick={() => refetch()}
          className="btn-secondary text-xs min-h-0 px-3 py-1.5 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-4 px-4">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => changeTab(tab.value)}
            className={`shrink-0 px-4 py-2 rounded-full lab transition-colors min-h-[36px] ${
              activeStatus === tab.value
                ? "bg-ink text-paper"
                : "bg-fill text-ink-sub hover:bg-fill2"
            }`}
          >
            {tab.label}
            {tab.value === "live" && activeStatus !== "live" && (
              <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Sport filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
        <Filter className="w-3.5 h-3.5 text-ink-faint shrink-0" />
        {SPORTS.map(s => (
          <button
            key={s}
            onClick={() => changeSport(s)}
            className={`shrink-0 px-3 py-1 rounded-full lab text-xs transition-colors ${
              activeSport === s
                ? "bg-brand-500 text-paper"
                : "bg-fill text-ink-sub hover:bg-fill2"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Match list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="skel h-36 rounded-xl" />)}
        </div>
      ) : allMatches.length === 0 ? (
        <div className="card px-6 py-12 text-center space-y-2">
          <Trophy className="w-10 h-10 text-ink-faint mx-auto" />
          <p className="font-semibold text-ink">No matches found</p>
          <p className="lab text-ink-sub">
            {activeStatus !== "all"
              ? `No ${activeStatus} matches${activeSport ? ` for ${activeSport}` : ""}.`
              : "No matches have been created yet."}
          </p>
          {(activeStatus !== "all" || activeSport) && (
            <button
              onClick={() => { setActiveStatus("all"); setActiveSport(""); }}
              className="btn-secondary text-sm mt-2"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {allMatches.map((match: any) => (
            <MatchCard key={match.id} match={match} />
          ))}

          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetching}
              className="btn-secondary w-full justify-center"
            >
              {isFetching ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
