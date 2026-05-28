import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getApiError } from "../api/client";
import { CheckCircle } from "lucide-react";

const ROLES = [
  { value: "athlete", label: "Athlete / Player", hint: "Build a profile, apply to trials." },
  { value: "club", label: "Club / Academy", hint: "Post trials & recruit talent." },
  { value: "scout", label: "Scout / Promoter", hint: "Search and shortlist players." },
  { value: "organizer", label: "Organizer", hint: "Create and manage events." }
];

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "athlete"
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    setEmailExists(false);
    setResendSent(false);
    try {
      await api.post("/auth/signup", form);
      setDone(true);
    } catch (e: any) {
      const er = getApiError(e);
      const msg = er.message + (er.details ? ` — ${JSON.stringify(er.details)}` : "");
      if (msg.toLowerCase().includes("email already")) setEmailExists(true);
      setErr(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    try {
      await api.post("/auth/resend-verification", { email: form.email });
      setResendSent(true);
    } catch {
      /* ignore */
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="card w-full max-w-md">
          <div className="card-body text-center">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-slate-600">
              We've sent a verification link to <strong>{form.email}</strong>. Click the link to activate your account, then sign in.
            </p>
            <Link to="/login" className="btn-primary mt-6 inline-flex">Go to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="card w-full max-w-lg">
        <div className="card-body">
          <h1 className="text-xl font-semibold">Create your Sportivox account</h1>
          <p className="mt-1 text-sm text-slate-600">Already have one? <Link to="/login" className="text-brand-700 font-medium">Sign in</Link></p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label">I am a...</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`cursor-pointer rounded-lg border p-3 text-sm ${form.role === r.value ? "border-brand-600 bg-brand-50" : "border-slate-200"}`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="sr-only"
                    />
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{r.hint}</div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="+91 0000000000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              <p className="text-xs text-slate-500 mt-1">Min 8 chars, 1 uppercase, 1 lowercase, 1 digit.</p>
            </div>
            {err && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{err}</div>}
            {emailExists && !resendSent && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Already have an account but haven't verified your email?{" "}
                <button type="button" onClick={resendVerification} className="font-medium underline hover:no-underline">
                  Resend verification email
                </button>
              </div>
            )}
            {resendSent && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                Verification email sent — check your inbox.
              </div>
            )}
            <button className="btn-primary w-full" disabled={submitting}>{submitting ? "Creating account..." : "Create account"}</button>
            <p className="text-xs text-slate-500 text-center">
              By signing up you agree to the Sportivox terms and privacy policy.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
