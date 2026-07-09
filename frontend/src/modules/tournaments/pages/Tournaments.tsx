import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { hasRole, isAdmin } from "../../../utils/roles";
import { useAuthStore } from "../../../store/auth";
import { useInfiniteOrgTournaments } from "../hooks/useOrgTournaments";
import { useTournaments } from "../../profile/hooks/useTournaments";
import { TileGrid } from "../../profile/components/TileGrid";
import { AddTournamentDrawer } from "../../profile/components/AddTournamentDrawer";
import { PageHeader, Spinner, EmptyState, StatusPill, Kicker } from "../../../components/UI";
import { humanizeError } from "../../../api/client";
import { Trash2, Pencil, MoreVertical, Radio, Trophy, Users } from "lucide-react";
import type { OrgTournament } from "../../../models";

type Tab = "ongoing" | "upcoming" | "completed" | "mine";

const TABS: { id: Tab; label: string }[] = [
  { id: "ongoing", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Past" },
  { id: "mine", label: "My tournaments" },
];

export default function Tournaments() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("ongoing");
  const [sport, setSport] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const canPost = hasRole(user?.role ?? "", "club", "organizer");
  const canTrackOwn = hasRole(user?.role ?? "", "athlete");

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-menu-button]") && !t.closest("[data-menu-content]")) setMenuOpenId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tournaments"
        subtitle="Live, upcoming, and yours"
        sticky
        action={canPost ? <Link to="/tournaments/new" className="btn-accent min-h-[44px] flex items-center">+ New tournament</Link> : undefined}
      />

      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
        <div className="flex gap-0 border-b border-hair min-w-max lg:min-w-0">
          {TABS.filter((t) => t.id !== "mine" || canTrackOwn).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mononum text-[11.5px] tracking-[0.05em] px-4 py-2.5 border-b-2 -mb-px transition whitespace-nowrap min-h-[44px] ${
                tab === t.id ? "border-brand-500 text-ink font-semibold" : "border-transparent text-ink-sub hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "mine" && canTrackOwn ? (
        <MyTournaments userId={user!.id} />
      ) : (
        <EventsList
          status={tab as "ongoing" | "upcoming" | "completed"}
          sport={sport}
          onSportChange={setSport}
          currentUserId={user?.id}
          isAdminUser={isAdmin(user?.role ?? "")}
          pendingDeleteId={pendingDeleteId}
          setPendingDeleteId={setPendingDeleteId}
          menuOpenId={menuOpenId}
          setMenuOpenId={setMenuOpenId}
        />
      )}
    </div>
  );
}

function EventsList({
  status,
  sport,
  onSportChange,
  currentUserId,
  isAdminUser,
  pendingDeleteId,
  setPendingDeleteId,
  menuOpenId,
  setMenuOpenId,
}: {
  status: "ongoing" | "upcoming" | "completed";
  sport: string;
  onSportChange: (s: string) => void;
  currentUserId?: string;
  isAdminUser: boolean;
  pendingDeleteId: string | null;
  setPendingDeleteId: (id: string | null) => void;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
}) {
  const { list, remove } = useInfiniteOrgTournaments({ status, sport: sport || undefined });
  const items = list.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <input
          className="input w-full sm:w-52 min-h-[44px]"
          placeholder="Filter by sport"
          value={sport}
          onChange={(e) => onSportChange(e.target.value)}
        />
      </div>

      {list.isLoading ? (
        <div className="panel p-8 flex justify-center"><Spinner className="text-brand-500" /></div>
      ) : !items.length ? (
        <EmptyState
          title={
            status === "ongoing" ? "No live tournaments right now"
            : status === "upcoming" ? "No upcoming tournaments"
            : "No past tournaments yet"
          }
          hint={status === "completed" ? "Tournaments show up here once they're marked completed." : "Check back later, or post a tournament if you manage a club or academy."}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                canManage={!!currentUserId && (t.organization?.owner_user_id === currentUserId || isAdminUser)}
                menuOpen={menuOpenId === t.id}
                onToggleMenu={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)}
                pendingDelete={pendingDeleteId === t.id}
                onRequestDelete={() => { setPendingDeleteId(t.id); setMenuOpenId(null); }}
                onCancelDelete={() => setPendingDeleteId(null)}
                onConfirmDelete={() => remove.mutate(t.id)}
                deleting={remove.isPending}
              />
            ))}
          </div>
          {list.hasNextPage && (
            <div className="flex justify-center">
              <button
                className="btn-secondary min-h-[44px]"
                onClick={() => list.fetchNextPage()}
                disabled={list.isFetchingNextPage}
              >
                {list.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TournamentCard({
  t,
  canManage,
  menuOpen,
  onToggleMenu,
  pendingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  deleting,
}: {
  t: OrgTournament;
  canManage: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  pendingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Kicker>{t.sport}{t.season ? ` · ${t.season}` : ""}</Kicker>
            <h3 className="font-disp text-xl mt-1.5 leading-tight">{t.name}</h3>
            <div className="lab mt-1">{t.organization?.org_name}</div>
          </div>
          <StatusPill status={t.status} />
        </div>
        <div className="mt-4 flex items-center gap-4 border-t border-hairsoft pt-3">
          <div className="flex items-center gap-1.5 text-sm text-ink-sub">
            <Users className="h-3.5 w-3.5" /> {t.teams?.length ?? 0} teams
          </div>
        </div>
      </div>

      <div className="px-5 pb-3 pt-3 border-t border-hairsoft flex items-center gap-2 flex-wrap">
        {t.scoring_tournament_id && (
          <Link
            to={`/scoring/tournaments/${t.scoring_tournament_id}`}
            className="btn-secondary text-xs min-h-0 px-3 py-1.5 flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
          >
            <Radio className="w-3 h-3" /> {t.status === "ongoing" ? "Live Scoring" : "View scorecard"}
          </Link>
        )}
      </div>

      {canManage && (
        <div className="px-5 pb-4 flex justify-end relative border-t border-hairsoft pt-3">
          <button data-menu-button onClick={onToggleMenu} className="btn-ghost p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div data-menu-content className="absolute right-4 bottom-12 panel shadow-pop z-10 min-w-36">
              <Link to={`/tournaments/${t.id}/edit`}
                className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-ink hover:bg-fill border-b border-hairsoft min-h-[44px]">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Link>
              <button onClick={onRequestDelete}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-[12.5px] text-red-600 hover:bg-red-50 min-h-[44px]">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
          {pendingDelete && (
            <div className="absolute right-4 bottom-14 panel shadow-pop z-10 p-3 flex items-center gap-2 min-w-52">
              <span className="text-[12.5px] text-ink flex-1">Delete this tournament?</span>
              <button onClick={onConfirmDelete} disabled={deleting} className="btn-danger min-h-[44px]">Confirm</button>
              <button onClick={onCancelDelete} className="btn-secondary min-h-[44px]">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MyTournaments({ userId }: { userId: string }) {
  const tournaments = useTournaments(userId);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  return (
    <div className="space-y-4">
      <TileGrid
        items={tournaments.list.data ?? []}
        maxItems={30}
        emptyIcon="🏆"
        emptyLabel="No tournaments added yet"
        emptyHint="Add tournaments you've played — name, year, team, format and result."
        onAdd={() => setAdding(true)}
        onEdit={(t) => setEditing(t)}
        onDelete={(i) => tournaments.remove.mutate(tournaments.list.data![i].id)}
        renderTile={(t) => (
          <div className="flex gap-2.5">
            <Trophy className="h-4 w-4 text-brand-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-medium text-ink pr-14">{t.name}</div>
              <div className="lab mt-1">{t.year}{t.team ? ` · ${t.team}` : ""}</div>
              {t.format && <div className="text-[12px] text-ink-sub mt-1">{t.format}</div>}
              {t.result && <div className="text-[12px] text-ink-sub mt-0.5">{t.result}</div>}
            </div>
          </div>
        )}
      />
      <AddTournamentDrawer
        isOpen={adding || !!editing}
        editing={editing}
        onClose={() => { setAdding(false); setEditing(null); }}
        isSubmitting={tournaments.add.isPending || tournaments.update.isPending}
        error={
          tournaments.add.isError ? humanizeError(tournaments.add.error)
          : tournaments.update.isError ? humanizeError(tournaments.update.error)
          : null
        }
        onSubmit={(data) => {
          if (editing) {
            tournaments.update.mutate({ tournamentId: editing.id, data }, { onSuccess: () => setEditing(null) });
          } else {
            tournaments.add.mutate(data, { onSuccess: () => setAdding(false) });
          }
        }}
      />
    </div>
  );
}
