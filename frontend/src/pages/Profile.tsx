import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Spinner, VerifiedBadge, Avatar, SectionHead, Kicker, StatCard, Placeholder, Tabs, Badge } from "../components/UI";
import type { Post, User } from "../types";

type Tab = "posts" | "followers" | "following";

function SpecRow({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-hairsoft last:border-0">
      <span className="lab">{label}</span>
      <span className="font-mononum text-[12.5px] text-right text-ink capitalize">{value}</span>
    </div>
  );
}

function PersonCard({ u }: { u: User }) {
  return (
    <Link to={`/profile/${u.id}`} className="card card-body flex items-center gap-3 transition hover:shadow-pop">
      <Avatar name={u.full_name} size={40} />
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
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const isMe = me?.id === id;
  const [tab, setTab] = useState<Tab>("posts");

  const userQ = useQuery({
    queryKey: ["user", id],
    queryFn: async () => (await api.get<{ user: User }>(`/users/${id}`)).data.user
  });
  const postsQ = useQuery({
    queryKey: ["user-posts", id],
    queryFn: async () => (await api.get<{ items: Post[] }>("/posts", { params: { author_id: id, limit: 10 } })).data.items
  });
  const followStatus = useQuery({
    queryKey: ["follow-status", id],
    queryFn: async () => (await api.get<{ following: boolean }>(`/follow/status/${id}`)).data.following,
    enabled: !isMe
  });
  const followersQ = useQuery({
    queryKey: ["followers", id],
    queryFn: async () => (await api.get<{ items: User[] }>(`/follow/${id}/followers`)).data.items,
    enabled: tab === "followers"
  });
  const followingQ = useQuery({
    queryKey: ["following", id],
    queryFn: async () => (await api.get<{ items: User[] }>(`/follow/${id}/following`)).data.items,
    enabled: tab === "following"
  });
  const reelsQ = useQuery({
    queryKey: ["user-reels", id],
    queryFn: async () => (await api.get<{ items: any[] }>("/reels", { params: { author_id: id, limit: 3 } })).data.items
  });

  async function toggleFollow() {
    if (followStatus.data) await api.delete(`/follow/${id}`);
    else await api.post(`/follow/${id}`);
    qc.invalidateQueries({ queryKey: ["follow-status", id] });
    qc.invalidateQueries({ queryKey: ["user", id] });
  }

  if (userQ.isLoading) return <div className="flex justify-center p-12"><Spinner className="text-brand-500" /></div>;
  const u = userQ.data;
  if (!u) return <div className="card card-body">Profile not found.</div>;

  const ath = u.athlete;
  const isAthlete = u.role === "athlete";
  const sport = ath?.primary_sport;
  const userStats: [string, string | number][] = ath?.stats ? Object.entries(ath.stats) : [];
  const achievements: { title: string; year: number; verified?: boolean; description?: string }[] = ath?.achievements ?? [];
  const careerHistory: { club: string; from?: string; to?: string | null; current?: boolean; years?: string }[] =
    ath?.career_history?.length
      ? ath.career_history
      : [
          ...(ath?.current_team ? [{ club: ath.current_team, current: true }] : []),
          ...(ath?.previous_teams ?? []).map((t: any) => ({ club: t.team, years: t.years, current: false }))
        ];

  const tabs: { id: Tab; label: string }[] = [
    { id: "posts", label: "Posts" },
    { id: "followers", label: `Followers (${u.follower_count})` },
    { id: "following", label: `Following (${u.following_count})` }
  ];

  return (
    <div className="space-y-6">
      {/* Cover band */}
      <div className="card overflow-hidden">
        <div className="relative h-32 bg-ink">
          <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 11px)" }} />
          {u.cover_photo_url && <img src={u.cover_photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        </div>
        <div className="card-body -mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="h-24 w-24 overflow-hidden rounded border-4 border-panel bg-fill">
                {u.profile_photo_url ? (
                  <img src={u.profile_photo_url} alt={u.full_name} className="h-full w-full object-cover" />
                ) : (
                  <Avatar name={u.full_name} size={88} className="!rounded-none border-0" />
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2.5">
                  <Kicker>{u.role}{sport ? ` · ${sport}` : ""}</Kicker>
                  <VerifiedBadge verification={u.verification} label="Verified" />
                </div>
                <h1 className="font-disp mt-1.5 text-4xl">{u.full_name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-sub">
                  {u.city && <span className="lab">{u.city}{u.country ? `, ${u.country}` : ""}</span>}
                  <span className="lab"><strong className="font-mononum text-ink">{u.follower_count}</strong> followers</span>
                  <span className="lab"><strong className="font-mononum text-ink">{u.following_count}</strong> following</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {isMe && <button className="btn-primary" onClick={() => navigate("/profile/edit")}>✎ Edit profile</button>}
              {!isMe && (
                <>
                  <button className="btn-primary" onClick={toggleFollow}>{followStatus.data ? "Following ✓" : "Follow"}</button>
                  <button className="btn-secondary" onClick={() => navigate(`/messages?to=${u.id}`)}>Message</button>
                </>
              )}
            </div>
          </div>

          {u.bio && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-70">{u.bio}</p>}

          {isAthlete && ath && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* ── ZONE 01 — Career summary ──────────────────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="01" title="Career summary" sub={sport ? `${sport} statistics` : "Headline numbers"} />
          {userStats.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {userStats.map(([k, v], i) => (
                <StatCard key={k} k={k} v={v} big={i < 2} />
              ))}
            </div>
          ) : ath ? (
            <div className="card card-body text-center">
              <div className="lab text-ink-faint">Performance stats not yet added</div>
              {isMe && (
                <button onClick={() => navigate("/profile/edit")} className="btn-secondary mt-3 mx-auto">+ Add stats</button>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── ZONE 02 — Detailed statistics ─────────────────────── */}
      {isAthlete && sport?.toLowerCase() === "cricket" && userStats.length > 0 && (
        <div>
          <SectionHead n="02" title="Detailed statistics" sub="By format" />
          <div className="card card-body">
            <div className="lab text-ink-faint">Format-by-format statistics not yet implemented</div>
            {isMe && (
              <button onClick={() => navigate("/profile/edit")} className="btn-secondary mt-3 mx-auto">+ Add format stats</button>
            )}
          </div>
        </div>
      )}

      {/* ── ZONE 03 — Achievements ────────────────────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="03" title="Achievements"
            right={isMe && achievements.length === 0 ? (
              <button onClick={() => navigate("/profile/edit")} className="btn-ghost text-[12px]">+ Add</button>
            ) : undefined}
          />
          {achievements.length > 0 ? (
            <div className="card card-body">
              {achievements.map((ac) => (
                <div key={ac.title} className="flex items-start gap-3 py-3 border-b border-hairsoft last:border-0">
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

      {/* ── ZONE 04 — Highlights & media ──────────────────────── */}
      {isAthlete && reelsQ.data && reelsQ.data.length > 0 && (
        <div>
          <SectionHead n="04" title="Highlights & media"
            right={<Link to="/reels" className="btn-ghost text-[12px]">All reels →</Link>}
          />
          <div className="grid grid-cols-3 gap-3">
            {reelsQ.data.slice(0, 3).map((r: any) => (
              <div key={r.id} className="card overflow-hidden cursor-pointer group">
                <div className="h-28 bg-ink relative overflow-hidden">
                  {r.thumbnail_url
                    ? <img src={r.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    : <Placeholder label="reel" height={112} />
                  }
                  <span className="absolute inset-0 flex items-center justify-center text-white/60 text-xl group-hover:text-white transition">▶</span>
                </div>
                <div className="px-3 py-2 flex items-center justify-between">
                  <p className="text-[12px] font-medium text-ink truncate">{r.caption || "Reel"}</p>
                  <span className="lab text-[10px] flex-shrink-0">▶ {r.view_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ZONE 05 — Availability & discovery ────────────────── */}
      {isAthlete && ath && (
        <div>
          <SectionHead n="05" title="Availability & discovery" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status & Preferences */}
            <div className="card card-body">
              <Kicker>Status & preferences</Kicker>
              <div className="mt-4">
                <SpecRow label="Status" value={ath.availability?.replace(/_/g, " ")} />
                <SpecRow label="Looking for club" value={ath.looking_for_club ? "Yes" : "No"} />
                {ath.experience_level && <SpecRow label="Experience" value={ath.experience_level.replace(/_/g, " ")} />}
                {u.country && <SpecRow label="Country" value={u.country} />}
              </div>
            </div>

            {/* Coach endorsements / Additional info */}
            <div className="card card-body">
              <Kicker>Scout & coach endorsements</Kicker>
              <div className="mt-4 lab text-ink-faint">Endorsements not yet added</div>
            </div>
          </div>
        </div>
      )}

      {/* ── ZONE 06 — Career timeline ───────────────────────── */}
      {isAthlete && careerHistory.length > 0 && (
        <div>
          <SectionHead n="06" title="Career timeline"
            right={isMe && careerHistory.length === 0 ? (
              <button onClick={() => navigate("/profile/edit")} className="btn-ghost text-[12px]">+ Add clubs</button>
            ) : undefined}
          />
          <div className="card card-body">
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
      )}

      {/* ── Activity section (not numbered) ───────────────────── */}
      <div>
        <div className="mb-4 flex gap-1 border-b border-hair">
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

        {tab === "posts" &&
          (postsQ.data?.length ? (
            <ul className="space-y-3">
              {postsQ.data.map((p) => (
                <li key={p.id} className="card card-body">
                  <div className="lab">{new Date(p.created_at).toLocaleString()}</div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-70">{p.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card card-body lab">No posts yet.</div>
          ))}

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
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="panel px-3.5 py-3">
      <div className="lab">{label}</div>
      <div className="font-disp mt-1.5 text-2xl capitalize">{value ?? "—"}</div>
    </div>
  );
}
