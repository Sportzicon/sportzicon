import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { api, humanizeError } from "../../../api/client";
import { queryKeys } from "../../../hooks/queryKeys";
import { uploadToGCS } from "../../../hooks/useUpload";
import { scoringApi } from "../../../api/scoringClient";
import { useAuthStore } from "../../../store/auth";
import { isAdmin, hasRole } from "../../../utils/roles";
import { Spinner, VerifiedBadge, Avatar, SectionHead, Kicker, Badge, StatusPill } from "../../../components/UI";
import { BackButton } from "../../../components/BackButton";
import type { User } from "../../../types";
import type { ScorecardLink, Tournament } from "../../../models";
import { useSavedOpportunities } from "../../../store/savedOpportunities";
import { Bookmark, Camera, FileText, Trash2, Trophy, Upload, X, Lock } from "lucide-react";
import { TileGrid } from "../components/TileGrid";
import { AddTournamentDrawer } from "../components/AddTournamentDrawer";
import { AddScorecardLinkDrawer } from "../components/AddScorecardLinkDrawer";
import { useTournaments } from "../hooks/useTournaments";
import { useScorecardLinkPreview, useUpdateScorecardLinks } from "../hooks/useScorecardLinks";
import { useDocuments } from "../hooks/useDocuments";
import { ProfileFeedTab } from "../components/ProfileFeedTab";
import { useMyAccessStatus, useRequestDocAccess } from "../../documentAccess/hooks/useDocumentAccess";
import { formatDate, formatDateTime } from "../../../utils/date";

// ── Cricbuzz-style cricket stats table ───────────────────────────────────────
function CricketStatRow({ label, values }: { label: string; values: (string | number)[] }) {
  return (
    <tr className="border-b border-hairsoft last:border-0 hover:bg-fill/50 transition">
      <td className="py-2.5 px-3 lab text-ink-sub text-left font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`py-2.5 px-3 font-mononum text-right text-sm ${i === 0 ? "text-ink font-bold text-base" : "text-ink-sub"}`}>
          {v ?? "—"}
        </td>
      ))}
    </tr>
  );
}

function CricketStatsSection({ userId, sport }: { userId: string; sport?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.cricketStatsByUser(userId),
    queryFn: () => scoringApi.get(`/players/by-user/${userId}/stats`).then(r => r.data),
    enabled: !!userId && sport?.toLowerCase() === "cricket"
  });

  if (!sport || sport.toLowerCase() !== "cricket") return null;
  if (isLoading) return <div className="skel h-48 rounded" />;
  if (!data) return (
    <div className="card card-body text-center border-dashed">
      <p className="lab text-ink-faint">No match statistics recorded yet</p>
    </div>
  );

  const bat  = data.batting;
  const bowl = data.bowling;

  return (
    <div className="space-y-4">
      {/* Batting */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 bg-ink text-paper flex items-center justify-between">
          <p className="lab tracking-wider text-sm font-semibold">BATTING</p>
          <p className="lab text-paper/50 text-xs">{bat.matches} match{bat.matches !== 1 ? "es" : ""}</p>
        </div>

        {/* Headline stats row — big numbers */}
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-hair border-b border-hair">
          {[
            { label: "RUNS",  value: bat.runs,         accent: true },
            { label: "HS",    value: bat.highest_score, accent: false },
            { label: "AVG",   value: bat.average,       accent: false },
            { label: "SR",    value: bat.strike_rate,   accent: false },
            { label: "100s",  value: bat.hundreds,      accent: false },
            { label: "50s",   value: bat.fifties,       accent: false },
          ].map(({ label, value, accent }) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="lab text-[9px] text-ink-faint mb-1">{label}</p>
              <p className={`font-mononum font-black ${accent ? "text-2xl text-brand-500" : "text-lg text-ink"}`}>{value ?? "—"}</p>
            </div>
          ))}
        </div>

        {/* Detailed table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-fill border-b border-hair">
              <th className="text-left py-2 px-3 lab text-ink-faint"></th>
              <th className="text-right py-2 px-3 lab text-ink-faint">Inn</th>
              <th className="text-right py-2 px-3 lab text-ink-faint">NO</th>
              <th className="text-right py-2 px-3 lab text-ink-faint">Runs</th>
              <th className="text-right py-2 px-3 lab text-ink-faint">Balls</th>
              <th className="text-right py-2 px-3 lab text-ink-faint">4s</th>
              <th className="text-right py-2 px-3 lab text-ink-faint">6s</th>
            </tr>
          </thead>
          <tbody>
            <CricketStatRow
              label="Overall"
              values={[bat.innings, bat.not_outs, bat.runs, bat.balls_faced, bat.fours, bat.sixes]}
            />
          </tbody>
        </table>
      </div>

      {/* Bowling */}
      {bowl && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 bg-ink text-paper flex items-center justify-between">
            <p className="lab tracking-wider text-sm font-semibold">BOWLING</p>
            <p className="lab text-paper/50 text-xs">{bowl.matches} match{bowl.matches !== 1 ? "es" : ""}</p>
          </div>

          {/* Headline stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-hair border-b border-hair">
            {[
              { label: "WKTS",  value: bowl.wickets,     accent: true },
              { label: "BBI",   value: bowl.best_bowling, accent: false },
              { label: "AVG",   value: bowl.average,      accent: false },
              { label: "ECO",   value: bowl.economy,      accent: false },
              { label: "SR",    value: bowl.strike_rate,  accent: false },
              { label: "5W",    value: bowl.five_wickets, accent: false },
            ].map(({ label, value, accent }) => (
              <div key={label} className="px-3 py-3 text-center">
                <p className="lab text-[9px] text-ink-faint mb-1">{label}</p>
                <p className={`font-mononum font-black ${accent ? "text-2xl text-brand-500" : "text-lg text-ink"}`}>{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {/* Detailed table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-fill border-b border-hair">
                <th className="text-left py-2 px-3 lab text-ink-faint"></th>
                <th className="text-right py-2 px-3 lab text-ink-faint">Inn</th>
                <th className="text-right py-2 px-3 lab text-ink-faint">Overs</th>
                <th className="text-right py-2 px-3 lab text-ink-faint">Mdns</th>
                <th className="text-right py-2 px-3 lab text-ink-faint">Runs</th>
                <th className="text-right py-2 px-3 lab text-ink-faint">Wkts</th>
                <th className="text-right py-2 px-3 lab text-ink-faint">ECO</th>
              </tr>
            </thead>
            <tbody>
              <CricketStatRow
                label="Overall"
                values={[bowl.innings, bowl.overs, bowl.maidens, bowl.runs, bowl.wickets, bowl.economy]}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type Tab = "followers" | "following" | "saved" | "emails";
type ProfileView = "overview" | "feed";

const PROFILE_DOC_TYPES = [
  "Sports CV",
  "Government ID",
  "Coach Endorsement",
  "Medical Certificate",
  "Fitness Report",
  "Training Certificate",
  "Reference Letter",
  "Academic Transcript",
  "Age Proof",
  "NOC from Current Club",
  "Passport Copy",
  "Other",
];

function PersonCard({ u }: { u: User }) {
  return (
    <Link to={`/profile/${u.id}`} className="card card-body flex items-center gap-3 transition hover:shadow-pop">
      <Avatar name={u.full_name} src={u.profile_photo_url} size={40} />
      <div>
        <div className="text-sm font-semibold text-ink">{u.full_name}</div>
        <div className="mt-1"><Badge color="blue">{u.role}</Badge></div>
      </div>
    </Link>
  );
}

export default function Profile() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user: me, setUser } = useAuthStore();
  const qc = useQueryClient();
  const isMe = me?.id === id;
  const [tab, setTab] = useState<Tab>("followers");
  const [view, setView] = useState<ProfileView>("overview");
  const [docType, setDocType] = useState("");
  const [uploadingName, setUploadingName] = useState<string>("");
  const docFileRef = useRef<HTMLInputElement>(null);
  const { saved: savedOpps, toggle: toggleSaved } = useSavedOpportunities();

  // Photo management state (only relevant when isMe)
  const [photoUploading, setPhotoUploading] = useState<"profile" | "cover" | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const coverPhotoRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File, field: "profile" | "cover") {
    setPhotoUploading(field);
    setPhotoError(null);
    try {
      const { url } = await uploadToGCS(file, "avatar");
      const key = field === "profile" ? "profile_photo_url" : "cover_photo_url";
      const r = await api.put("/users/me", { [key]: url });
      const updated: User = r.data.user;
      setUser(updated);
      qc.setQueryData(["user", id], updated);
    } catch (e) {
      setPhotoError(humanizeError(e));
    } finally {
      setPhotoUploading(null);
    }
  }

  async function removePhoto(field: "profile" | "cover") {
    setPhotoUploading(field);
    setPhotoError(null);
    try {
      const key = field === "profile" ? "profile_photo_url" : "cover_photo_url";
      const r = await api.put("/users/me", { [key]: null });
      const updated: User = r.data.user;
      setUser(updated);
      qc.setQueryData(["user", id], updated);
    } catch (e) {
      setPhotoError(humanizeError(e));
    } finally {
      setPhotoUploading(null);
    }
  }

  const userQ = useQuery({
    queryKey: queryKeys.user(id),
    queryFn: async () => (await api.get<{ user: User }>(`/users/${id}`)).data.user
  });
  const followStatus = useQuery({
    queryKey: queryKeys.followStatus(id),
    queryFn: async () => (await api.get<{ following: boolean }>(`/follow/status/${id}`)).data.following,
    enabled: !isMe
  });
  const followersQ = useQuery({
    queryKey: queryKeys.followers(id),
    queryFn: async () => (await api.get<{ items: User[] }>(`/follow/${id}/followers`)).data.items,
    enabled: tab === "followers"
  });
  const followingQ = useQuery({
    queryKey: queryKeys.following(id),
    queryFn: async () => (await api.get<{ items: User[] }>(`/follow/${id}/following`)).data.items,
    enabled: tab === "following"
  });

  const isRecruiterViewer = !isMe && hasRole(me?.role ?? "", "club", "scout", "organizer");
  const myAccessStatus = useMyAccessStatus(id, isRecruiterViewer);
  const requestDocAccess = useRequestDocAccess(id);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(null);
  const canViewDocuments = isMe || isAdmin(me?.role ?? "") || myAccessStatus.data === "approved";
  const { docsQ, uploadDoc, deleteDoc, uploadProgress } = useDocuments(id, canViewDocuments);

  const tournaments = useTournaments(id);
  const [addingTournament, setAddingTournament] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  const scorecardPreview = useScorecardLinkPreview();
  const updateScorecardLinks = useUpdateScorecardLinks(id);
  const [addingLink, setAddingLink] = useState(false);
  const [editingLink, setEditingLink] = useState<{ index: number; link: ScorecardLink } | null>(null);

  const emailLogsQ = useQuery({
    queryKey: queryKeys.emailLogs(id),
    queryFn: async () =>
      (await api.get<{ items: any[]; total: number; stats: any }>(`/users/${id}/email-logs`)).data,
    enabled: tab === "emails" && (isMe || isAdmin(me?.role ?? ""))
  });

  const [followError, setFollowError] = useState<string | null>(null);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (followStatus.data) return api.delete(`/follow/${id}`);
      return api.post(`/follow/${id}`);
    },
    onSuccess: () => {
      setFollowError(null);
      qc.invalidateQueries({ queryKey: queryKeys.followStatus(id) });
      qc.invalidateQueries({ queryKey: queryKeys.user(id) });
      if (me?.id) qc.invalidateQueries({ queryKey: queryKeys.user(me.id) });
    },
    onError: (err) => setFollowError(humanizeError(err)),
  });

  if (userQ.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  const u = userQ.data;
  if (!u) return <div className="card card-body">Profile not found.</div>;

  const ath = u.athlete;
  const isAthlete = u.role === "athlete";
  const sport = ath?.primary_sport;
  const scorecardLinks: ScorecardLink[] = ath?.scorecard_links ?? [];
  const achievements = (ath?.achievements ?? []).map((a: unknown) =>
    typeof a === "string"
      ? { title: a, year: undefined as number | undefined, verified: false, description: undefined as string | undefined }
      : a as { title: string; year?: number; verified?: boolean; description?: string }
  );
  const careerHistory: { club: string; from?: string; to?: string | null; current?: boolean; years?: string }[] =
    ath?.career_history?.length
      ? ath.career_history
      : [
          ...(ath?.current_team ? [{ club: ath.current_team, current: true }] : []),
          ...(ath?.previous_teams ?? []).map((t: any) => ({ club: t.team, years: t.years, current: false }))
        ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "followers", label: `Followers (${u.follower_count})` },
    { id: "following", label: `Following (${u.following_count})` },
    ...(isMe && !isAdmin(u.role ?? "") ? [{ id: "saved" as Tab, label: `Saved (${savedOpps.length})` }] : []),
    ...(isMe || isAdmin(me?.role ?? "") ? [{ id: "emails" as Tab, label: "Email History" }] : [])
  ];

  return (
    <div className="space-y-6">
      <BackButton className="-mb-2" />

      {/* Cover band */}
      <div className="card overflow-hidden">
        <div className="relative h-32 bg-ink group/cover">
          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" }} />
          {u.cover_photo_url && <img src={u.cover_photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          {photoUploading === "cover" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="font-mononum text-[11px] text-white tracking-[0.06em] uppercase">Uploading…</span>
            </div>
          )}
          {isMe && (
            <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover/cover:opacity-100 transition-opacity">
              <button
                onClick={() => coverPhotoRef.current?.click()}
                disabled={!!photoUploading}
                className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-white text-[11px] font-mononum hover:bg-black/80 transition disabled:opacity-40"
              >
                <Camera className="h-3 w-3" /> Update cover
              </button>
              {u.cover_photo_url && (
                <button
                  onClick={() => removePhoto("cover")}
                  disabled={!!photoUploading}
                  className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-white text-[11px] font-mononum hover:bg-red-600/80 transition disabled:opacity-40"
                >
                  <X className="h-3 w-3" /> Remove
                </button>
              )}
              <input ref={coverPhotoRef} type="file" accept="image/*" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "cover"); e.currentTarget.value = ""; }} />
            </div>
          )}
        </div>
        <div className="card-body -mt-12">
          {photoError && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{photoError}</div>
          )}

          {/* Mobile: centered stack. Desktop: left-aligned row */}
          <div className="flex flex-col items-center text-center lg:flex-row lg:items-end lg:text-left lg:justify-between gap-4">
            <div className="flex flex-col items-center lg:flex-row lg:items-end gap-4">
              {/* Avatar — 96px mobile, 128px desktop */}
              <div className="relative group/avatar flex-shrink-0">
                <div className="h-24 w-24 lg:h-32 lg:w-32 overflow-hidden rounded border-4 border-panel bg-fill flex items-center justify-center">
                  {u.profile_photo_url ? (
                    <img src={u.profile_photo_url} alt={u.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-fill">
                      <span className="font-disp text-3xl lg:text-4xl text-ink-sub select-none">
                        {u.full_name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                  )}
                  {photoUploading === "profile" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                      <span className="font-mononum text-[9px] text-white text-center leading-tight tracking-[0.04em] uppercase px-1">Uploading…</span>
                    </div>
                  )}
                </div>
                {isMe && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 rounded opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                    <button
                      onClick={() => profilePhotoRef.current?.click()}
                      disabled={!!photoUploading}
                      className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-[10px] font-mononum hover:bg-black/90 transition disabled:opacity-40 whitespace-nowrap"
                    >
                      <Camera className="h-2.5 w-2.5" /> Update
                    </button>
                    {u.profile_photo_url && (
                      <button
                        onClick={() => removePhoto("profile")}
                        disabled={!!photoUploading}
                        className="flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-white text-[10px] font-mononum hover:bg-red-600/80 transition disabled:opacity-40 whitespace-nowrap"
                      >
                        <X className="h-2.5 w-2.5" /> Remove
                      </button>
                    )}
                    <input ref={profilePhotoRef} type="file" accept="image/*" className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, "profile"); e.currentTarget.value = ""; }} />
                  </div>
                )}
              </div>

              {/* Name / role / location — centered on mobile */}
              <div className="pb-1">
                <div className="flex items-center justify-center lg:justify-start gap-2.5">
                  <Kicker>{u.role}{sport ? ` · ${sport}` : ""}</Kicker>
                  <VerifiedBadge verification={u.verification} label="Verified" />
                </div>
                <h1 className="font-disp mt-1.5 text-3xl lg:text-4xl">{u.full_name}</h1>
                {/* Stats row — horizontal scroll on mobile so it never wraps */}
                <div className="mt-2 flex items-center gap-3 overflow-x-auto justify-center lg:justify-start">
                  {u.city && <span className="lab whitespace-nowrap">{u.city}{u.country ? `, ${u.country}` : ""}</span>}
                  <span className="lab whitespace-nowrap"><strong className="font-mononum text-ink">{u.follower_count}</strong> followers</span>
                  <span className="lab whitespace-nowrap"><strong className="font-mononum text-ink">{u.following_count}</strong> following</span>
                </div>
              </div>
            </div>

            {/* Action buttons — full width on mobile */}
            <div className="w-full lg:w-auto flex flex-col sm:flex-row lg:flex-row gap-2">
              {isMe && (
                <button className="btn-primary w-full sm:w-auto min-h-[44px]" onClick={() => navigate("/profile/edit")}>
                  ✎ Edit profile
                </button>
              )}
              {!isMe && (
                <>
                  <button
                    className="btn-primary w-full sm:w-auto min-h-[44px] disabled:opacity-60"
                    onClick={() => followMutation.mutate()}
                    disabled={followMutation.isPending || followStatus.isLoading}
                  >
                    {followMutation.isPending
                      ? "…"
                      : followStatus.data
                      ? "Following ✓"
                      : "Follow"}
                  </button>
                  <button className="btn-secondary w-full sm:w-auto min-h-[44px]" onClick={() => navigate(`/messages?to=${u.id}`)}>
                    Message
                  </button>
                </>
              )}
            </div>
          </div>

          {followError && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{followError}</div>
          )}

          {/* Bio — full width, wraps correctly */}
          {u.bio && <p className="mt-5 text-[15px] leading-relaxed text-ink-70">{u.bio}</p>}

          {/* Athlete stats — two columns on desktop, scrollable on mobile */}
          {isAthlete && ath && (
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Sport" value={ath.primary_sport} />
              <Stat label="Position" value={ath.position ?? ath.playing_role} />
              <Stat label="Experience" value={ath.experience_level?.replace(/_/g, " ")} />
              <Stat label="Availability" value={ath.availability?.replace(/_/g, " ")} />
              {ath.height_cm && <Stat label="Height" value={`${ath.height_cm} cm`} />}
              {ath.weight_kg && <Stat label="Weight" value={`${ath.weight_kg} kg`} />}
              {typeof ath.looking_for_club === "boolean" && (
                <Stat label="Looking for club" value={ath.looking_for_club ? "Yes" : "No"} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Top-level profile view switch ──────────────────────── */}
      <div className="sticky -top-4 sm:-top-7 z-30 bg-paper -mx-3 sm:-mx-6 px-3 sm:px-6 pt-3 sm:pt-4 flex gap-1 border-b-2 border-ink">
        <button
          onClick={() => setView("overview")}
          className={`font-disp text-sm px-5 py-3 border-b-2 -mb-0.5 transition ${
            view === "overview" ? "border-brand-500 text-ink" : "border-transparent text-ink-sub hover:text-ink"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView("feed")}
          className={`font-disp text-sm px-5 py-3 border-b-2 -mb-0.5 transition ${
            view === "feed" ? "border-brand-500 text-ink" : "border-transparent text-ink-sub hover:text-ink"
          }`}
        >
          Feed
        </button>
      </div>

      {view === "feed" && <ProfileFeedTab userId={id} isOwner={isMe} />}

      {view === "overview" && (
      <>
      {/* ── ZONE 01 — Career summary (summary + timeline, side by side) ── */}
      {isAthlete && (
        <div>
          <SectionHead n="01" title="Career summary"
            right={isMe ? (
              <button onClick={() => navigate("/profile/edit")} className="btn-ghost text-[12px]">
                {careerHistory.length === 0 ? "+ Add clubs" : "Edit"}
              </button>
            ) : undefined}
          />
          <div className="grid grid-cols-1 md:grid-cols-[7fr_3fr] gap-4">
            {ath?.career_summary ? (
              <div className="card card-body">
                <Kicker>Career summary</Kicker>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-70 whitespace-pre-wrap">{ath.career_summary}</p>
              </div>
            ) : (
              <div className="card card-body text-center border-dashed">
                <div className="lab text-ink-faint">No career summary added yet</div>
                {isMe && (
                  <button onClick={() => navigate("/profile/edit")} className="btn-secondary mt-3 mx-auto">+ Add summary</button>
                )}
              </div>
            )}

            {careerHistory.length > 0 ? (
              <div className="card card-body">
                <Kicker>Career timeline</Kicker>
                <div className="mt-4">
                  {careerHistory.map((h, i, arr) => {
                    const label = h.current
                      ? "Present"
                      : h.years ?? (h.from ? `${h.from.slice(0, 7)}${h.to ? ` → ${h.to.slice(0, 7)}` : " → present"}` : "");
                    return (
                      <div key={h.club + i} className="flex gap-4 pb-4 last:pb-0">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full"
                            style={{ background: h.current ? "#FA4D14" : "rgba(20,17,13,0.2)" }} />
                          {i < arr.length - 1 && (
                            <span className="w-px flex-1 bg-hair mt-1" style={{ minHeight: 24 }} />
                          )}
                        </div>
                        <div>
                          <div className="text-[13.5px] font-semibold text-ink">{h.club}</div>
                          <div className="lab mt-0.5">{label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="card card-body text-center border-dashed">
                <div className="lab text-ink-faint">No career history added yet</div>
                {isMe && <p className="text-[12.5px] text-ink-sub mt-1">Add clubs, teams and career milestones.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ZONE 02 — Tournaments ──────────────────────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="02" title="Tournaments" sub="Competitions this athlete has played" />
          <TileGrid
            items={tournaments.list.data ?? []}
            maxItems={30}
            emptyIcon="🏆"
            emptyLabel="No tournaments added yet"
            emptyHint="Add tournaments you've played — name, year, team, format and result."
            onAdd={isMe ? () => setAddingTournament(true) : undefined}
            onEdit={isMe ? (t) => setEditingTournament(t) : undefined}
            onDelete={isMe ? (i) => tournaments.remove.mutate(tournaments.list.data![i].id) : undefined}
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
          {isMe && (
            <AddTournamentDrawer
              isOpen={addingTournament || !!editingTournament}
              editing={editingTournament}
              onClose={() => { setAddingTournament(false); setEditingTournament(null); }}
              isSubmitting={tournaments.add.isPending || tournaments.update.isPending}
              error={
                tournaments.add.isError ? humanizeError(tournaments.add.error)
                : tournaments.update.isError ? humanizeError(tournaments.update.error)
                : null
              }
              onSubmit={(data) => {
                if (editingTournament) {
                  tournaments.update.mutate(
                    { tournamentId: editingTournament.id, data },
                    { onSuccess: () => setEditingTournament(null) }
                  );
                } else {
                  tournaments.add.mutate(data, { onSuccess: () => setAddingTournament(false) });
                }
              }}
            />
          )}
        </div>
      )}

      {/* ── ZONE 03 — Statistics (cricket live, or format placeholder) ── */}
      {isAthlete && sport?.toLowerCase() === "cricket" && (
        <div>
          <SectionHead n="03" title="Statistics" sub="From recorded matches on Sportzicon" />
          <CricketStatsSection userId={id} sport={sport} />
        </div>
      )}
      {isAthlete && sport?.toLowerCase() !== "cricket" && (
        <div>
          <SectionHead n="03" title="Statistics" sub="By format" />
          <div className="card card-body text-center border-dashed">
            <div className="lab text-ink-faint">Format-by-format statistics not yet added</div>
            {isMe && (
              <button onClick={() => navigate("/profile/edit")} className="btn-secondary mt-3 mx-auto">+ Add format stats</button>
            )}
          </div>
        </div>
      )}

      {/* ── ZONE 04 — Scorecard & scoring-app links ────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="04" title="Scorecard & scoring links" sub="Link out to CricHeroes, CricClubs and other scoring apps" />
          <TileGrid
            items={scorecardLinks}
            maxItems={15}
            emptyIcon="🔗"
            emptyLabel="No scorecard links added yet"
            emptyHint="Paste links to your match scorecards on other scoring apps."
            onAdd={isMe ? () => setAddingLink(true) : undefined}
            onEdit={isMe ? (link, i) => setEditingLink({ index: i, link }) : undefined}
            onDelete={isMe ? (i) => updateScorecardLinks.mutate(scorecardLinks.filter((_, idx) => idx !== i)) : undefined}
            renderTile={(link) => (
              <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 pr-14">
                {link.preview_image ? (
                  <img src={link.preview_image} alt="" className="h-10 w-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded bg-fill flex items-center justify-center text-ink-faint flex-shrink-0">🔗</div>
                )}
                <div className="min-w-0">
                  <div className="lab text-brand-500 truncate">{link.source}</div>
                  <div className="text-[12.5px] font-medium text-ink truncate">{link.preview_title ?? link.label ?? "View scorecard →"}</div>
                </div>
              </a>
            )}
          />
          {isMe && (
            <AddScorecardLinkDrawer
              isOpen={addingLink || !!editingLink}
              editing={editingLink?.link}
              onClose={() => { setAddingLink(false); setEditingLink(null); }}
              isSubmitting={updateScorecardLinks.isPending}
              onPreview={(url) => scorecardPreview.mutateAsync(url)}
              onSubmit={(data) => {
                if (editingLink) {
                  const next = scorecardLinks.map((l, idx) => (idx === editingLink.index ? data : l));
                  updateScorecardLinks.mutate(next, { onSuccess: () => setEditingLink(null) });
                } else {
                  updateScorecardLinks.mutate([...scorecardLinks, data], { onSuccess: () => setAddingLink(false) });
                }
              }}
            />
          )}
        </div>
      )}

      {/* ── ZONE 05 — Achievements ────────────────────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="05" title="Achievements"
            right={isMe && achievements.length === 0 ? (
              <button onClick={() => navigate("/profile/edit")} className="btn-ghost text-[12px]">+ Add</button>
            ) : undefined}
          />
          {achievements.length > 0 ? (
            <div className="card card-body">
              {achievements.map((ac: { title?: string; year?: number; verified?: boolean; description?: string }, idx: number) => (
                <div key={ac.title ?? idx} className="flex items-start gap-3 py-3 border-b border-hairsoft last:border-0">
                  <span className={`text-lg ${ac.verified ? "text-brand-500" : "text-ink-faint"}`}>♛</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-[13.5px] font-medium text-ink">{ac.title}</div>
                      {ac.verified && <span className="text-[9px] text-emerald-700">✓</span>}
                    </div>
                    {ac.description && <div className="text-[12px] text-ink-sub mt-0.5">{ac.description}</div>}
                  </div>
                  <span className="font-mononum text-[11px] text-ink-faint flex-shrink-0">{ac.year}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="card card-body text-center border-dashed">
              <div className="text-3xl text-ink-faint mb-2">♛</div>
              <div className="lab text-ink-faint">No achievements added yet</div>
              {isMe && <p className="text-[12.5px] text-ink-sub mt-1">Add titles, awards and competition results.</p>}
            </div>
          )}
        </div>
      )}

      {/* ── ZONE 06 — Documents (owner, admin, or approved requester) ── */}
      {isAthlete && !isMe && isRecruiterViewer && myAccessStatus.data !== "approved" && (
        <div>
          <SectionHead n="06" title="Documents" sub="This athlete's supporting documents are private" />
          <div className="card card-body space-y-3 text-center py-6">
            <Lock className="h-5 w-5 text-ink-faint mx-auto" />
            {myAccessStatus.data === "pending" ? (
              <p className="lab text-[11px] text-ink-sub">Request pending — you'll be notified when reviewed.</p>
            ) : (
              <>
                <p className="lab text-[11px] text-ink-sub">Request access to view this athlete's documents.</p>
                {accessRequestError && <p className="text-[12px] text-red-600">{accessRequestError}</p>}
                <button
                  className="btn-secondary min-h-[44px] px-4"
                  disabled={requestDocAccess.isPending}
                  onClick={() =>
                    requestDocAccess.mutate(undefined, { onError: (err) => setAccessRequestError(humanizeError(err)) })
                  }
                >
                  {requestDocAccess.isPending ? "Requesting…" : "Request access to documents"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isAthlete && canViewDocuments && (
        <div>
          <SectionHead n="06" title="Documents"
            sub="Attach supporting documents to strengthen your profile"
            right={isMe ? (
              <Link to="/profile/document-access" className="btn-ghost text-[11.5px] min-h-[44px] inline-flex items-center">
                Manage access requests →
              </Link>
            ) : undefined}
          />
          <div className="card card-body space-y-3">
            {/* Uploaded documents list */}
            {docsQ.data && docsQ.data.length > 0 ? (
              docsQ.data.map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 rounded border border-emerald-200 bg-emerald-50/40 p-3.5">
                  <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mononum text-[11px] uppercase tracking-[0.06em] text-ink">{doc.type}</div>
                    {doc.file_name && (
                      <a href={doc.url} target="_blank" rel="noreferrer"
                        className="lab text-[10.5px] text-emerald-700 hover:underline truncate block mt-0.5">
                        {doc.file_name}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={doc.url} target="_blank" rel="noreferrer"
                      className="font-mononum text-[9px] text-emerald-700 bg-emerald-100 px-2 py-1 rounded hover:bg-emerald-200 transition">
                      View / Download
                    </a>
                    {isMe && (
                      <button onClick={() => deleteDoc.mutate(doc.id)} disabled={deleteDoc.isPending || uploadDoc.isPending}
                        className="text-ink-faint hover:text-red-500 transition" title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : null}

            {/* Upload progress row */}
            {uploadProgress !== null && (
              <div className="rounded border border-blue-200 bg-blue-50/40 p-3.5">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="h-4 w-4 text-blue-500 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mononum text-[11px] uppercase tracking-[0.06em] text-ink">{docType || "Uploading…"}</div>
                    <div className="lab text-[10.5px] text-blue-600 truncate mt-0.5">{uploadingName}</div>
                  </div>
                  <span className="font-mononum text-[11px] text-blue-600 flex-shrink-0">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Add document — dropdown + upload (owner only) */}
            {isMe && (
              <div className="flex gap-2 items-center flex-wrap pt-1">
                <select
                  className="input font-mononum flex-1 min-w-[200px]"
                  style={{ fontSize: 12, height: 36 }}
                  value={docType}
                  disabled={uploadDoc.isPending}
                  onChange={(e) => {
                    setDocType(e.target.value);
                    if (docFileRef.current) docFileRef.current.value = "";
                  }}
                >
                  <option value="">Select document type…</option>
                  {PROFILE_DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <label className={`flex-shrink-0 ${!docType || uploadDoc.isPending ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}>
                  <input
                    ref={docFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    disabled={!docType || uploadDoc.isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file || !docType) return;
                      if (file.size > 5 * 1024 * 1024) {
                        alert(`File too large. Maximum size is 5 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.`);
                        if (docFileRef.current) docFileRef.current.value = "";
                        return;
                      }
                      uploadDoc.mutate({ file, type: docType });
                      setDocType("");
                      if (docFileRef.current) docFileRef.current.value = "";
                    }}
                  />
                  <span className="flex items-center gap-1.5 btn-secondary text-[11px] px-3 py-2 whitespace-nowrap">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadDoc.isPending ? "Uploading…" : "Upload file"}
                  </span>
                </label>
              </div>
            )}

            {isMe && (
              <p className="lab text-[10.5px] text-ink-faint border-t border-hairsoft pt-3 mt-1">
                Documents are reviewed during verification. Max file size 5 MB per file.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Activity section (not numbered) ───────────────────── */}
      <div>
        <div className="mb-4 flex gap-1 border-b border-hair overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`font-mononum -mb-px border-b-2 px-4 py-2.5 text-[11.5px] transition ${
                tab === t.id ? "border-brand-500 font-semibold text-ink" : "border-transparent text-ink-sub hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "followers" &&
          (followersQ.isLoading ? (
            <Spinner className="text-brand-500" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {followersQ.data?.length ? (
                followersQ.data.map((f) => <PersonCard key={f.id} u={f} />)
              ) : (
                <div className="card card-body lab">No followers yet.</div>
              )}
            </div>
          ))}

        {tab === "following" &&
          (followingQ.isLoading ? (
            <Spinner className="text-brand-500" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {followingQ.data?.length ? (
                followingQ.data.map((f) => <PersonCard key={f.id} u={f} />)
              ) : (
                <div className="card card-body lab">Not following anyone yet.</div>
              )}
            </div>
          ))}

        {tab === "emails" && (isMe || isAdmin(me?.role ?? "")) && (
          <div className="space-y-4">
            {emailLogsQ.isLoading ? (
              <div className="flex justify-center p-8"><Spinner className="text-brand-500" /></div>
            ) : emailLogsQ.data ? (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total sent", value: emailLogsQ.data.stats.total ?? 0 },
                    { label: "Delivered", value: emailLogsQ.data.stats.by_status?.sent ?? 0 },
                    { label: "Failed", value: emailLogsQ.data.stats.by_status?.failed ?? 0 },
                    { label: "Stub (dev)", value: emailLogsQ.data.stats.by_status?.stub ?? 0 },
                  ].map((s) => (
                    <div key={s.label} className="card card-body text-center py-3">
                      <div className="font-disp text-2xl text-ink">{s.value}</div>
                      <div className="lab mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Email log table */}
                {emailLogsQ.data.items.length > 0 ? (
                  <div className="card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr className="border-b border-hair bg-fill">
                            <th className="text-left px-4 py-2.5 lab">Date</th>
                            <th className="text-left px-4 py-2.5 lab">Subject</th>
                            <th className="text-left px-4 py-2.5 lab">Type</th>
                            <th className="text-left px-4 py-2.5 lab">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emailLogsQ.data.items.map((log: any) => (
                            <tr key={log.id} className="border-b border-hairsoft last:border-0 hover:bg-fill/50 transition">
                              <td className="px-4 py-3 font-mononum text-[11px] text-ink-sub whitespace-nowrap">
                                {formatDateTime(log.created_at)}
                              </td>
                              <td className="px-4 py-3 text-ink max-w-[200px] truncate">{log.subject}</td>
                              <td className="px-4 py-3">
                                <span className="font-mononum text-[10px] uppercase tracking-wide bg-fill border border-hairsoft rounded px-1.5 py-0.5 capitalize">
                                  {log.email_type.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`font-mononum text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
                                  log.status === "sent" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : log.status === "failed" ? "bg-red-50 text-red-600 border border-red-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="card card-body text-center lab text-ink-faint py-8">No emails sent yet.</div>
                )}
              </>
            ) : (
              <div className="card card-body lab text-ink-faint text-center py-8">Could not load email history.</div>
            )}
          </div>
        )}

        {tab === "saved" && isMe && (
          savedOpps.length ? (
            <div className="flex flex-col gap-3">
              {savedOpps.map((o) => (
                <div key={o.id} className="card overflow-hidden">
                  <Link to={`/opportunities/${o.id}`} className="block p-4 hover:bg-fill transition">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded bg-fill border border-hairsoft flex-shrink-0 flex items-center justify-center">
                        <span className="font-disp text-lg text-ink-sub">{(o.org_name ?? "?")[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          <span className="badge capitalize">{o.type}</span>
                          <span className="badge">{o.sport}</span>
                          <StatusPill status={o.status} />
                        </div>
                        <div className="font-disp text-lg leading-tight">{o.title}</div>
                        <div className="lab mt-1">{o.org_name} · {o.city}, {o.country}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-hairsoft flex items-center justify-between">
                      <span className="lab">Deadline: {formatDate(o.application_deadline)}</span>
                      <span className="font-mononum text-[11px]"
                        style={{ color: Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000) <= 5 ? "#FA4D14" : "#9A9286" }}>
                        {Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000) < 0
                          ? "Closed"
                          : `${Math.ceil((new Date(o.application_deadline).getTime() - Date.now()) / 86400_000)}d left`}
                      </span>
                    </div>
                  </Link>
                  <div className="px-4 pb-3 border-t border-hairsoft">
                    <button
                      onClick={() => toggleSaved(o)}
                      className="font-mononum text-[10.5px] flex items-center gap-1.5 text-brand-500 hover:text-red-600 transition mt-2.5"
                    >
                      <Bookmark className="h-3.5 w-3.5" fill="currentColor" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card card-body text-center">
              <Bookmark className="h-8 w-8 text-ink-faint mx-auto mb-2" />
              <div className="lab text-ink-faint">No saved opportunities</div>
              <p className="text-[12.5px] text-ink-sub mt-1">Browse opportunities and click Save to bookmark them here.</p>
              <Link to="/opportunities" className="btn-secondary mt-3 inline-block">Browse opportunities →</Link>
            </div>
          )
        )}
      </div>
      </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="panel px-3.5 py-3">
      <div className="lab truncate">{label}</div>
      <div className="font-disp mt-1.5 text-base sm:text-2xl capitalize leading-snug">{value ?? "—"}</div>
    </div>
  );
}
