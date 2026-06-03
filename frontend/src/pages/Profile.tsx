import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Spinner, VerifiedBadge, Avatar, SectionHead, Kicker, StatCard, Placeholder, Tabs, Badge, StatusPill } from "../components/UI";
import type { Post, User } from "../types";
import { useSavedOpportunities } from "../store/savedOpportunities";
import { Bookmark, FileText, Trash2, Upload } from "lucide-react";

type Tab = "posts" | "followers" | "following" | "saved";

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
  const [docType, setDocType] = useState("");
  const docFileRef = useRef<HTMLInputElement>(null);
  const { saved: savedOpps, toggle: toggleSaved, isSaved } = useSavedOpportunities();

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

  const docsQ = useQuery({
    queryKey: ["user-docs", id],
    queryFn: async () => (await api.get<{ items: any[] }>(`/users/${id}/documents`)).data.items,
  });

  const uploadDoc = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      return api.post(`/users/${id}/documents`, form, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-docs", id] }),
  });

  const deleteDoc = useMutation({
    mutationFn: async (docId: string) => api.delete(`/users/${id}/documents/${docId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-docs", id] }),
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
    { id: "following", label: `Following (${u.following_count})` },
    ...(isMe ? [{ id: "saved" as Tab, label: `Saved (${savedOpps.length})` }] : [])
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
            <div className="flex flex-wrap gap-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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

      {/* ── ZONE 07 — Documents ───────────────────────────────── */}
      {isAthlete && (
        <div>
          <SectionHead n="07" title="Documents"
            sub={isMe ? "Attach supporting documents to strengthen your profile" : "Supporting documents"}
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
                  <span className="font-mononum text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded flex-shrink-0">✓ Uploaded</span>
                  {isMe && (
                    <button onClick={() => deleteDoc.mutate(doc.id)} disabled={deleteDoc.isPending}
                      className="text-ink-faint hover:text-red-500 transition flex-shrink-0" title="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : !isMe ? (
              <div className="lab text-ink-faint text-center py-4">No documents uploaded.</div>
            ) : null}

            {/* Add document — dropdown + upload (owner only) */}
            {isMe && (
              <div className="flex gap-2 items-center flex-wrap pt-1">
                <select
                  className="input font-mononum flex-1 min-w-[200px]"
                  style={{ fontSize: 12, height: 36 }}
                  value={docType}
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

                <label className={`flex-shrink-0 ${!docType ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}>
                  <input
                    ref={docFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    disabled={!docType}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && docType) {
                        uploadDoc.mutate({ file, type: docType });
                        setDocType("");
                        if (docFileRef.current) docFileRef.current.value = "";
                      }
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
                      <span className="lab">Deadline: {new Date(o.application_deadline).toLocaleDateString()}</span>
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
