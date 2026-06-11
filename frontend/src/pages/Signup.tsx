import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, humanizeError } from "../api/client";
import { COUNTRIES, COUNTRY_PHONE, statesForCountry } from "../data/geo";
import { Eye, EyeOff } from "lucide-react";

const ROLES = [
  { value: "athlete", label: "Athlete / Player", hint: "Build a profile, upload stats, get discovered and apply to trials." },
  { value: "club", label: "Club / Academy", hint: "Post trials, search talent, manage applications." },
  { value: "scout", label: "Scout / Promoter", hint: "Search and shortlist players, view verified stats." },
  { value: "organizer", label: "Organizer", hint: "Create events, accept registrations, manage participants." }
];

const SPORTS = ["Cricket", "Football", "Athletics", "Basketball", "Hockey", "Tennis", "Badminton", "Kabaddi"];
const LEVELS = ["Beginner", "Amateur", "Academy", "Semi-professional", "State", "National", "Professional"];
const ORG_TYPES = ["Club", "Academy", "Both"];
const STORE_KEY = "sx_signup_draft";

type Draft = {
  step: number;
  role: string;
  user_id: string;
  full_name: string; email: string; phone: string; password: string;
  country: string; state: string; city: string; dob: string;
  primary_sport: string; play_role: string; level: string; looking: boolean;
  org_name: string; org_type: string; org_sport: string;
};

const DEFAULT: Draft = {
  step: 0, role: "athlete", user_id: "",
  full_name: "", email: "", phone: "", password: "",
  country: "", state: "", city: "", dob: "",
  primary_sport: "Cricket", play_role: "", level: "", looking: true,
  org_name: "", org_type: "", org_sport: "Cricket"
};

function load(): Draft {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

function save(d: Partial<Draft>) {
  const curr = load();
  localStorage.setItem(STORE_KEY, JSON.stringify({ ...curr, ...d }));
}

function clear() { localStorage.removeItem(STORE_KEY); }

function Field({ label, req, hint, children }: {
  label: string; req?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}{req && <span className="text-brand-500"> *</span>}</span>
      {children}
      {hint && <span className="lab mt-1.5 block normal-case tracking-normal text-[10.5px]">{hint}</span>}
    </label>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]" style={{ color: met ? "#16a34a" : "#6b7280" }}>
      <span style={{ display: "inline-block" }}>{met ? "✓" : "○"}</span>
      {text}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition"
      style={{
        background: active ? "#14110D" : undefined,
        color: active ? "#F7F5EF" : undefined,
        borderColor: active ? "#14110D" : undefined
      }}>
      {label}
    </button>
  );
}

// Renders a dial-code prefix + digits-only number input.
// For known countries the prefix is fixed; for "Other" the user can type the code.
function PhoneInput({ country, value, onChange }: {
  country: string;
  value: string;           // full number stored as "dialCode + localDigits", e.g. "+919876543210"
  onChange: (full: string) => void;
}) {
  const info = COUNTRY_PHONE[country];
  const dial  = info?.dial ?? "";
  const maxLocal = info?.max ?? 15;

  // Derive the editable local part from the stored full value
  const localDigits = value.startsWith(dial) ? value.slice(dial.length) : value.replace(/\D/g, "");

  function handleChange(raw: string) {
    // Strip everything except digits
    const digits = raw.replace(/\D/g, "").slice(0, maxLocal);
    onChange(dial + digits);
  }

  if (!info) {
    // "Other" — allow free entry but block alphabets; user must include country code
    return (
      <input
        className="input font-mononum"
        type="tel"
        inputMode="tel"
        placeholder="+XX 9876543210"
        value={value}
        maxLength={20}
        onChange={(e) => {
          // Allow digits, +, spaces, hyphens, parentheses only
          const cleaned = e.target.value.replace(/[^\d+\s\-()]/g, "").slice(0, 20);
          onChange(cleaned);
        }}
      />
    );
  }

  return (
    <div className="flex">
      <span className="inline-flex items-center px-3 rounded-l border border-r-0 border-[#D4D0C8] bg-[#F2F1EC] font-mononum text-[13px] text-ink-sub select-none whitespace-nowrap">
        {dial}
      </span>
      <input
        className="input rounded-l-none flex-1 font-mononum"
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={info.placeholder}
        value={localDigits}
        maxLength={maxLocal}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
}

// Sports where a playing position is not meaningful
const SPORTS_WITHOUT_POSITION = ["swimming", "gymnastics", "crossfit", "cycling", "rowing", "skiing"];

export default function Signup() {
  const navigate = useNavigate();
  const [d, setDraft] = useState<Draft>(DEFAULT);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [resumedUserId, setResumedUserId] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Restore from localStorage on mount; clear it when user navigates away
  useEffect(() => {
    setDraft(load());
    return () => { clear(); };
  }, []);

  const isAthlete = d.role === "athlete";

  const STEPS = isAthlete
    ? ["Role", "Account", "Sport profile", "Verify email"]
    : ["Role", "Account", "Organisation", "Verify email"];

  function patch(updates: Partial<Draft>) {
    const next = { ...d, ...updates };
    setDraft(next);
    save(next);
  }

  // ── Step advance helpers ──────────────────────────────────────────────────

  function validatePassword(pwd: string): string | null {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must contain an uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must contain a lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must contain a digit";
    return null;
  }

  function advanceRole() {
    save({ step: 1, role: d.role });
    setDraft((p) => ({ ...p, step: 1 }));
  }

  async function advanceAccount() {
    if (!d.full_name || !d.email || !d.phone || !d.password || !d.country || !d.state || !d.city) {
      setErr("Please fill all required fields."); return;
    }
    const phoneDigits = d.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) { setErr("Phone number must be at least 10 digits."); return; }
    const pwdErr = validatePassword(d.password);
    if (pwdErr) { setErr(pwdErr); return; }
    setErr(null);
    setEmailExists(false);
    setResumedUserId(null);
    setSubmitting(true);
    try {
      const res = await api.post("/auth/register/basic", {
        ...(d.user_id ? { user_id: d.user_id } : {}),
        email: d.email, password: d.password,
        full_name: d.full_name, phone: d.phone, role: d.role,
        country: d.country || undefined, state: d.state || undefined,
        city: d.city || undefined, dob: d.dob || undefined
      });
      if (res.data.resumed) {
        // Incomplete signup detected — don't overwrite saved data, let user choose to resume
        setResumedUserId(res.data.user_id);
      } else {
        patch({ step: 2, user_id: res.data.user_id as string });
      }
    } catch (e) {
      const msg = humanizeError(e);
      if (msg.toLowerCase().includes("email already exists")) {
        setEmailExists(true);
      } else {
        setErr(msg);
      }
    } finally { setSubmitting(false); }
  }

  function back(toStep: number) {
    setErr(null);
    save({ step: toStep });
    setDraft((p) => ({ ...p, step: toStep }));
  }

  async function submit() {
    // Guard: no user_id means step 2 was never completed — send them back
    if (!d.user_id) {
      setErr(null);
      save({ step: 1 });
      setDraft((p) => ({ ...p, step: 1 }));
      return;
    }
    const requiresPosition = !SPORTS_WITHOUT_POSITION.includes(d.primary_sport?.toLowerCase() ?? "");
    if (isAthlete && (requiresPosition && !d.play_role || !d.level)) {
      setErr("Please select your playing role and experience level."); return;
    }
    if (!isAthlete && (!d.org_name || !d.org_type)) {
      setErr("Please fill in your organisation name and type."); return;
    }
    setSubmitting(true); setErr(null);
    try {
      const res = await api.post("/auth/register/profile", {
        user_id: d.user_id,
        ...(isAthlete ? {
          primary_sport: d.primary_sport || undefined,
          position: d.play_role || undefined,
          experience_level: d.level?.toLowerCase().replace(/-/g, "_") || undefined,
          looking_for_club: d.looking
        } : {
          org_name: d.org_name || undefined,
          org_type: d.org_type?.toLowerCase() || undefined,
          org_sport: d.org_sport || undefined
        })
      });
      clear();
      setDraft((p) => ({ ...p, step: 3, email: res.data.email ?? p.email }));
    } catch (e) {
      setErr(humanizeError(e));
    } finally { setSubmitting(false); }
  }

  async function resend() {
    try { await api.post("/auth/resend-verification", { email: d.email }); setResendSent(true); }
    catch { /* ignore */ }
  }

  const step = d.step;

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-paper grid lg:grid-cols-[minmax(300px,420px)_1fr]">

      {/* ── left ink rail ─────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col bg-ink text-paper px-10 py-12">
        <h1 className="font-disp text-[44px] text-paper leading-[0.98]">
          Join the<br /><span className="text-brand-500">network.</span>
        </h1>
        <p className="mt-5 text-[14.5px] leading-relaxed text-white/60 max-w-[300px]">
          A few quick steps to set up your verified account. You can complete the rest of your profile later.
        </p>
        <div className="mt-11 flex flex-col gap-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-3 py-[11px] border-b border-white/10"
              style={{ opacity: i <= step ? 1 : 0.4 }}>
              <span className="font-mononum w-[26px] h-[26px] rounded-full border flex items-center justify-center text-[11px] flex-shrink-0"
                style={{
                  borderColor: i <= step ? "#FA4D14" : "rgba(255,255,255,0.3)",
                  color: i < step ? "#14110D" : "#F7F5EF",
                  background: i < step ? "#FA4D14" : "transparent"
                }}>
                {i < step ? "✓" : String(i + 1)}
              </span>
              <span className="font-mononum text-[12px] tracking-[0.04em]">{s}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto lab text-white/40">Step {step + 1} of {STEPS.length}</div>
      </div>

      {/* ── right form ────────────────────────────────────────────── */}
      <div className="flex items-start justify-center px-4 pt-10 pb-12 sm:px-8 sm:pt-14 overflow-y-auto">
        <div className="w-full max-w-[680px] animate-fadein">
          {/* ── STEP 0: Role ─────────────────────────────────────── */}
          {step === 0 && (
            <div>
              <div className="kicker">Step 1 — Choose your role</div>
              <h2 className="font-disp text-[34px] mt-3">How will you use Sportzicon?</h2>
              <p className="text-sm text-ink-sub mt-2">Your role sets your permissions. It can't be changed later.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {ROLES.map((r) => (
                  <button key={r.value} type="button" onClick={() => patch({ role: r.value })}
                    className="panel p-[18px] text-left transition"
                    style={{
                      borderColor: d.role === r.value ? "#14110D" : undefined,
                      borderWidth: d.role === r.value ? 1.5 : 1,
                      background: d.role === r.value ? "#F2F1EC" : undefined
                    }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-disp text-[19px]">{r.label}</span>
                      <span className="w-4 h-4 rounded-full border flex items-center justify-center text-white text-[9px] flex-shrink-0"
                        style={{
                          borderColor: d.role === r.value ? "#FA4D14" : "rgba(20,17,13,0.2)",
                          background: d.role === r.value ? "#FA4D14" : "transparent"
                        }}>
                        {d.role === r.value ? "✓" : ""}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-ink-sub mt-2 leading-snug">{r.hint}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center mt-8">
                <Link to="/login" className="lab text-ink-sub hover:text-ink">Already have an account?</Link>
                <button className="btn-primary" onClick={advanceRole}>Continue →</button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Account details ───────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="kicker">Step 2 — Account details</div>
              <h2 className="font-disp text-[34px] mt-3">Create your account</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mt-6">
                <Field label="Full name" req>
                  <input className="input" value={d.full_name} onChange={(e) => patch({ full_name: e.target.value })} autoFocus />
                </Field>
                <Field label="Email" req hint="Verification link sent on signup.">
                  <input
                    className="input"
                    type="email"
                    value={d.email}
                    onChange={(e) => { patch({ email: e.target.value }); setEmailExists(false); setResumedUserId(null); }}
                  />
                </Field>
                <Field label="Country" req>
                  <select className="input" value={d.country} onChange={(e) => {
                    const newCountry = e.target.value;
                    const oldInfo = COUNTRY_PHONE[d.country];
                    const newInfo = COUNTRY_PHONE[newCountry];
                    // Preserve local digits when switching between two known countries
                    let newPhone = "";
                    if (oldInfo && newInfo && d.phone) {
                      const localDigits = d.phone.startsWith(oldInfo.dial)
                        ? d.phone.slice(oldInfo.dial.length)
                        : d.phone.replace(/\D/g, "");
                      newPhone = newInfo.dial + localDigits;
                    }
                    patch({ country: newCountry, state: "", phone: newPhone });
                  }}>
                    <option value="">Select country</option>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="State" req>
                  {statesForCountry(d.country) ? (
                    <select className="input" value={d.state} onChange={(e) => patch({ state: e.target.value })}>
                      <option value="">Select state…</option>
                      {statesForCountry(d.country)!.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input" placeholder="e.g. Maharashtra" value={d.state} onChange={(e) => patch({ state: e.target.value })} />
                  )}
                </Field>
                <Field label="City" req>
                  <input className="input" placeholder="e.g. Pune" value={d.city} onChange={(e) => patch({ city: e.target.value })} />
                </Field>
                <Field label="Phone" req hint="For OTP verification.">
                  <PhoneInput
                    country={d.country}
                    value={d.phone}
                    onChange={(v) => patch({ phone: v })}
                  />
                </Field>
                <Field label="Password" req>
                  <div className="relative">
                    <input className="input pr-9" type={showPwd ? "text" : "password"} value={d.password} onChange={(e) => patch({ password: e.target.value })} minLength={8} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition" tabIndex={-1}>
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    <PasswordRequirement met={d.password.length >= 8} text="At least 8 characters" />
                    <PasswordRequirement met={/[A-Z]/.test(d.password)} text="One uppercase letter" />
                    <PasswordRequirement met={/[a-z]/.test(d.password)} text="One lowercase letter" />
                    <PasswordRequirement met={/[0-9]/.test(d.password)} text="One digit" />
                  </div>
                </Field>
                {isAthlete && (
                  <Field label="Date of birth" req hint="Age is used for opportunity filters.">
                    <input className="input font-mononum" type="date" value={d.dob}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => patch({ dob: e.target.value })} />
                  </Field>
                )}
              </div>
              {resumedUserId && (
                <div className="mt-4 rounded bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                  You have an incomplete signup with this email.{" "}
                  <button
                    type="button"
                    className="font-semibold underline hover:text-amber-950"
                    onClick={() => {
                      const uid = resumedUserId!;
                      setResumedUserId(null);
                      patch({ step: 2, user_id: uid });
                    }}
                  >
                    Continue signup →
                  </button>
                </div>
              )}
              {emailExists && (
                <div className="mt-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  An account with this email already exists.{" "}
                  <Link to="/login" className="font-semibold underline hover:text-red-900">Sign in instead →</Link>
                </div>
              )}
              {err && <div className="mt-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
              <div className="flex justify-between items-center mt-7">
                <button type="button" className="btn-ghost" onClick={() => back(0)}>← Back</button>
                <button type="button" className="btn-primary" disabled={submitting} onClick={advanceAccount}>
                  {submitting ? "Saving…" : "Continue →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2a: Sport profile (athlete) ─────────────────── */}
          {step === 2 && isAthlete && (
            <div>
              <div className="kicker">Step 3 — Sport profile</div>
              <h2 className="font-disp text-[34px] mt-3">Tell scouts about your game</h2>
              <div className="mt-6 flex flex-col gap-6">
                <Field label="Primary sport" req>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {SPORTS.map((s) => (
                      <Chip key={s} label={s} active={d.primary_sport === s} onClick={() => patch({ primary_sport: s })} />
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Playing role" req>
                    <select className="input" value={d.play_role} onChange={(e) => patch({ play_role: e.target.value })}>
                      <option value="">Select playing role</option>
                      {(d.primary_sport === "Cricket"
                        ? ["Batter", "Bowler", "All-rounder", "Wicket-keeper"]
                        : d.primary_sport === "Football"
                        ? ["Goalkeeper", "Defender", "Midfielder", "Winger", "Striker"]
                        : d.primary_sport === "Basketball"
                        ? ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Centre"]
                        : d.primary_sport === "Hockey"
                        ? ["Goalkeeper", "Defender", "Midfielder", "Forward"]
                        : d.primary_sport === "Kabaddi"
                        ? ["Raider", "Defender", "All-rounder"]
                        : d.primary_sport === "Tennis" || d.primary_sport === "Badminton"
                        ? ["Singles specialist", "Doubles specialist", "All-court"]
                        : d.primary_sport === "Athletics"
                        ? ["Sprinter", "Middle distance", "Long distance", "Jumper", "Thrower", "Multi-event"]
                        : ["Attacker", "Defender", "All-rounder", "Other"]
                      ).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Experience level" req>
                    <select className="input" value={d.level} onChange={(e) => patch({ level: e.target.value })}>
                      <option value="">Select experience level</option>
                      {LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Looking for a club / academy / trial?">
                  <div className="flex gap-3 mt-1.5">
                    {([["Yes", true], ["Not right now", false]] as const).map(([l, v]) => (
                      <button key={l} type="button" onClick={() => patch({ looking: v })}
                        className="font-mononum text-[10px] uppercase tracking-[0.08em] px-3 py-2 rounded border transition"
                        style={{
                          background: d.looking === v ? "#FEE9E0" : undefined,
                          color: d.looking === v ? "#B23A0E" : undefined,
                          borderColor: d.looking === v ? "#F6C9B6" : undefined
                        }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="panel p-4 flex gap-3" style={{ borderStyle: "dashed", background: "#F2F1EC" }}>
                  <span className="text-brand-500 mt-0.5 flex-shrink-0">◆</span>
                  <div className="text-[12.5px] text-ink-sub leading-relaxed">
                    <strong className="text-ink">You'll add detailed stats next.</strong> After signup, your profile opens to a guided stats editor — format-by-format figures, batting/bowling styles, and a Sports CV upload.
                  </div>
                </div>
              </div>
              {err && <div className="mt-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
              <div className="flex justify-between items-center mt-8">
                <button type="button" className="btn-ghost" onClick={() => back(1)}>← Back</button>
                <button type="button" className="btn-accent" disabled={submitting} onClick={submit}>
                  {submitting ? "Creating account…" : "Create account →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2b: Organisation (non-athlete) ──────────────── */}
          {step === 2 && !isAthlete && (
            <div>
              <div className="kicker">Step 3 — Organisation</div>
              <h2 className="font-disp text-[34px] mt-3">Set up your organisation</h2>
              <div className="mt-6 flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Organisation name" req>
                    <input className="input" value={d.org_name} onChange={(e) => patch({ org_name: e.target.value })} placeholder="e.g. Maharashtra State XI" />
                  </Field>
                  <Field label="Type" req>
                    <select className="input" value={d.org_type} onChange={(e) => patch({ org_type: e.target.value })}>
                      <option value="">Select type</option>
                      {ORG_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Sport categories" req>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {SPORTS.slice(0, 6).map((s) => (
                      <Chip key={s} label={s} active={d.org_sport === s} onClick={() => patch({ org_sport: s })} />
                    ))}
                  </div>
                </Field>
                <div className="panel p-4 flex gap-3" style={{ borderStyle: "dashed", background: "#F2F1EC" }}>
                  <span className="text-brand-500 mt-0.5 flex-shrink-0">◆</span>
                  <div className="text-[12.5px] text-ink-sub leading-relaxed">
                    <strong className="text-ink">Verification required to post.</strong> Upload your registration certificate after signup — an admin reviews it and issues your <strong className="text-ink">Verified Club</strong> badge.
                  </div>
                </div>
              </div>
              {err && <div className="mt-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-800">{err}</div>}
              <div className="flex justify-between items-center mt-8">
                <button type="button" className="btn-ghost" onClick={() => back(1)}>← Back</button>
                <button type="button" className="btn-accent" disabled={submitting} onClick={submit}>
                  {submitting ? "Creating account…" : "Create account →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Verify email ──────────────────────────────── */}
          {step === 3 && (
            <div className="max-w-[480px]">
              <div className="kicker">Step 4 — Verify your email</div>
              <h2 className="font-disp text-[34px] mt-3">Check your inbox</h2>
              <div className="panel p-6 mt-6 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto"
                  style={{ background: "#FEE9E0", color: "#FA4D14" }}>✉</div>
                <p className="text-sm text-ink-sub mt-4 leading-relaxed max-w-xs mx-auto">
                  We sent a verification link to <strong className="text-ink">{d.email}</strong>. Your account stays inactive until you confirm — this keeps the network trustworthy.
                </p>
                <p className="text-sm text-ink-sub mt-2 leading-relaxed max-w-xs mx-auto">
                  Don't see it? Check your <strong className="text-ink">spam or junk folder</strong>.
                </p>
                <div className="flex gap-3 justify-center mt-5">
                  <button className="btn-primary" onClick={() => navigate("/login")}>I've verified — sign in →</button>
                </div>
                {!resendSent ? (
                  <button type="button" onClick={resend}
                    className="lab mt-3 text-brand-500 cursor-pointer hover:underline block mx-auto">
                    Didn't get it? Resend link
                  </button>
                ) : (
                  <p className="lab mt-3 text-emerald-600">✓ Verification email resent — check your inbox and spam/junk folder</p>
                )}
              </div>
              <div className="flex justify-between mt-5">
                <button type="button" className="btn-ghost" onClick={() => back(2)}>← Back</button>
                <button type="button" className="btn-ghost" onClick={() => navigate("/login")}>Skip for now →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
