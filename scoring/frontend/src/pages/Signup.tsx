import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";
import { Trophy } from "lucide-react";

export default function Signup() {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "viewer" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", form);
      setAuth(data.user, data.access_token, data.refresh_token);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Signup failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg text-emerald-600">ScoreBoard</span>
        </div>
        <h1 className="text-xl font-bold mb-6">Create account</h1>
        {error && <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.full_name} onChange={e => update("full_name", e.target.value)} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => update("email", e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={e => update("password", e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => update("role", e.target.value)}>
              <option value="viewer">Viewer (watch scores)</option>
              <option value="scorer">Scorer (enter ball-by-ball)</option>
              <option value="organizer">Organizer (manage tournaments)</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-center mt-4 text-gray-500">
          Have an account? <Link to="/login" className="text-emerald-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
