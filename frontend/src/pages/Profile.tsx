import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { PageHeader, Spinner, VerifiedBadge, Badge } from "../components/UI";
import type { Post, User } from "../types";

export default function Profile() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const isMe = me?.id === id;

  const userQ = useQuery({
    queryKey: ["user", id],
    queryFn: async () => (await api.get<{ user: User }>(`/users/${id}`)).data.user
  });
  const postsQ = useQuery({
    queryKey: ["user-posts", id],
    queryFn: async () => (await api.get<{ items: Post[]; next_cursor: string | null }>("/posts", { params: { author_id: id, limit: 10 } })).data.items
  });
  const followStatus = useQuery({
    queryKey: ["follow-status", id],
    queryFn: async () => (await api.get<{ following: boolean }>(`/follow/status/${id}`)).data.following,
    enabled: !isMe
  });

  async function toggleFollow() {
    if (followStatus.data) {
      await api.delete(`/follow/${id}`);
    } else {
      await api.post(`/follow/${id}`);
    }
    qc.invalidateQueries({ queryKey: ["follow-status", id] });
    qc.invalidateQueries({ queryKey: ["user", id] });
  }

  if (userQ.isLoading) return <Spinner />;
  const u = userQ.data;
  if (!u) return <div className="card card-body">Profile not found.</div>;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-brand-600 to-brand-400" />
        <div className="card-body -mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full border-4 border-white bg-slate-200 overflow-hidden">
                {u.profile_photo_url && <img src={u.profile_photo_url} alt={u.full_name} className="h-full w-full object-cover" />}
              </div>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  {u.full_name}
                  <VerifiedBadge verification={u.verification} />
                </h1>
                <p className="text-sm text-slate-600">
                  <Badge color="blue">{u.role}</Badge>{" "}
                  {u.city && <span className="ml-2">{u.city}, {u.country}</span>}
                </p>
                {u.bio && <p className="text-sm text-slate-700 mt-2 max-w-xl">{u.bio}</p>}
                <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                  <span><strong>{u.follower_count}</strong> followers</span>
                  <span><strong>{u.following_count}</strong> following</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {isMe && <button className="btn-secondary" onClick={() => navigate("/profile/edit")}>Edit profile</button>}
              {!isMe && (
                <>
                  <button className="btn-primary" onClick={toggleFollow}>
                    {followStatus.data ? "Unfollow" : "Follow"}
                  </button>
                  <button className="btn-secondary" onClick={() => navigate(`/messages?to=${u.id}`)}>Message</button>
                </>
              )}
            </div>
          </div>

          {u.role === "athlete" && u.athlete && (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <Stat label="Sport" value={u.athlete.primary_sport} />
              <Stat label="Position" value={u.athlete.position} />
              <Stat label="Experience" value={u.athlete.experience_level} />
              <Stat label="Availability" value={u.athlete.availability} />
            </div>
          )}
        </div>
      </div>

      <div>
        <PageHeader title="Posts" subtitle="Training logs and updates" />
        {postsQ.data?.length ? (
          <ul className="space-y-3">
            {postsQ.data.map((p) => (
              <li key={p.id} className="card card-body">
                <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{p.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card card-body text-sm text-slate-600">No posts yet.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-900">{value ?? "—"}</div>
    </div>
  );
}
