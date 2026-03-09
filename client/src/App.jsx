import { useState, useEffect, useCallback } from "react";
import {
  signUpWithEmail, signInWithEmail, signInWithGoogle,
  logout, getIdToken, onAuth,
} from "./firebase";

const API = "/api";

async function apiFetch(method, path, body, token) {
  const t = token || (await getIdToken().catch(() => null));
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

const C = {
  bg: "#07070f", surface: "#0f0f1a", border: "#1c1c2e",
  purple: "#7c3aed", purpleHi: "#a78bfa", green: "#22c55e",
  amber: "#f59e0b", red: "#ef4444", muted: "#475569",
  text: "#e2e8f0", sub: "#94a3b8",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500&family=Syne:wght@700;800&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:${C.bg};color:${C.text};font-family:'DM Mono',monospace}
  input,textarea,select,button{font-family:inherit}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:none;border-radius:8px;font-size:13px;font-weight:500;padding:10px 20px;cursor:pointer;transition:all .18s;white-space:nowrap}
  .btn-primary{background:${C.purple};color:#fff}
  .btn-primary:hover{background:#6d28d9;transform:translateY(-1px)}
  .btn-primary:disabled{opacity:.4;pointer-events:none}
  .btn-google{background:#fff;color:#1f1f1f;border:1px solid #ddd}
  .btn-google:hover{background:#f8f8f8;transform:translateY(-1px)}
  .btn-ghost{background:${C.border};color:${C.sub}}
  .btn-ghost:hover{background:#252540;color:${C.text}}
  .btn-success{background:#14532d44;color:${C.green};border:1px solid #22c55e33}
  .btn-success:hover{background:#14532d88}
  .btn-danger{background:#3f121233;color:${C.red}}
  .btn-danger:hover{background:#5a1a1a}
  .card{background:${C.surface};border:1px solid ${C.border};border-radius:12px}
  .input{width:100%;background:${C.bg};border:1px solid ${C.border};border-radius:8px;color:${C.text};padding:10px 14px;font-size:13px;transition:border-color .15s}
  .input:focus{outline:none;border-color:${C.purple}}
  .input::placeholder{color:${C.muted}}
  .divider{display:flex;align-items:center;gap:12px;color:${C.muted};font-size:12px;margin:16px 0}
  .divider::before,.divider::after{content:'';flex:1;height:1px;background:${C.border}}
  .row-hover:hover{background:#12122088}
  .tab{background:none;border:none;padding:7px 16px;border-radius:8px;font-size:13px;cursor:pointer;transition:all .15s}
  .tab.active{background:#1a1a2e;color:${C.purpleHi}}
  .tab.inactive{color:${C.muted}}
  .tab.inactive:hover{color:${C.text}}
  .fade{animation:fadeUp .3s ease forwards}
  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  .trial-bar{padding:8px 24px;font-size:12px;display:flex;align-items:center;justify-content:center;gap:12px}
  .trial-bar.warning{background:#78350f44;border-bottom:1px solid #f59e0b33;color:${C.amber}}
  .trial-bar.ok{background:#1e1b4b;border-bottom:1px solid #4338ca33;color:${C.purpleHi}}
  .trial-bar.active{background:#14532d33;border-bottom:1px solid #22c55e33;color:${C.green}}
`;

function Label({ children, required }) {
  return <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}</div>;
}

function Alert({ type = "error", children }) {
  const s = { error: { bg: "#3f121233", border: "#ef444433", color: C.red }, success: { bg: "#14532d33", border: "#22c55e33", color: C.green }, info: { bg: "#1e1b4b", border: "#4338ca33", color: C.purpleHi } }[type];
  return <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: s.color, marginTop: 12 }}>{children}</div>;
}

function Logo({ size = "lg" }) {
  const big = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: big ? 10 : 8, marginBottom: big ? 36 : 0, justifyContent: "center" }}>
      <div style={{ width: big ? 36 : 30, height: big ? 36 : 30, background: `linear-gradient(135deg,${C.purple},${C.purpleHi})`, borderRadius: big ? 10 : 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: big ? 18 : 15 }}>✉</div>
      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: big ? 22 : 17, color: "#fff" }}>MailForge</span>
    </div>
  );
}

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

function StepIndicator({ current, total, labels }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, transition: "all .2s", background: i <= current ? C.purple : C.border, color: i <= current ? "#fff" : C.muted, boxShadow: i === current ? `0 0 0 3px ${C.purple}44` : "none" }}>
              {i < current ? "✓" : i + 1}
            </div>
            {labels && <div style={{ fontSize: 10, color: i === current ? C.purpleHi : C.muted, whiteSpace: "nowrap" }}>{labels[i]}</div>}
          </div>
          {i < total - 1 && <div style={{ width: 48, height: 1, background: i < current ? C.purple : C.border, margin: "0 4px", marginBottom: labels ? 20 : 0 }} />}
        </div>
      ))}
    </div>
  );
}

function ProfileForm({ initial = {}, onSubmit, loading, error, submitLabel = "Continue →", showNameField = true }) {
  const [form, setForm] = useState({ name: initial.name || "", company: initial.company || "", phone: initial.phone || "" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const valid = (!showNameField || form.name.trim()) && form.company.trim() && form.phone.trim();
  return (
    <div>
      {showNameField && <div style={{ marginBottom: 12 }}><Label required>Full Name</Label><input className="input" placeholder="Jane Doe" value={form.name} onChange={set("name")} /></div>}
      <div style={{ marginBottom: 12 }}><Label required>Company</Label><input className="input" placeholder="Acme Inc." value={form.company} onChange={set("company")} /></div>
      <div style={{ marginBottom: 20 }}>
        <Label required>Phone Number</Label>
        <input className="input" type="tel" placeholder="+1 555 000 0000" value={form.phone} onChange={set("phone")} />
        <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>Include country code, e.g. +44 7700 900000</div>
      </div>
      {error && <Alert type="error">{error}</Alert>}
      <button className="btn btn-primary" style={{ width: "100%", padding: "11px", marginTop: 4 }} onClick={() => onSubmit(form)} disabled={loading || !valid}>
        {loading ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

// ── TRIAL / SUBSCRIPTION BANNER ───────────────────────────────────────────────
function SubscriptionBanner({ billing }) {
  if (!billing) return null;
  const { subscriptionStatus, trialDaysLeft, planType, planDaysLeft } = billing;

  if (subscriptionStatus === "trial") {
    const warn = trialDaysLeft <= 3;
    return (
      <div className={`trial-bar ${warn ? "warning" : "ok"}`}>
        {warn ? "⚠️" : "⏱"}
        <span>
          {warn
            ? `Your free trial ends in ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""}! Contact your admin to subscribe.`
            : `Free trial active — ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining.`
          }
        </span>
      </div>
    );
  }

  if (subscriptionStatus === "active") {
    const warn = planDaysLeft <= 7;
    return (
      <div className={`trial-bar ${warn ? "warning" : "active"}`}>
        {warn ? "⚠️" : "✅"}
        <span>
          {warn
            ? `Your ${planType} subscription expires in ${planDaysLeft} day${planDaysLeft !== 1 ? "s" : ""}. Contact admin to renew.`
            : `${planType?.charAt(0).toUpperCase() + planType?.slice(1)} plan active — ${planDaysLeft} day${planDaysLeft !== 1 ? "s" : ""} remaining.`
          }
        </span>
      </div>
    );
  }

  return null;
}

// ── EXPIRED WALL ──────────────────────────────────────────────────────────────
function ExpiredWall({ billing, onLogout }) {
  const isTrial = !billing?.planType;
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🔒</div>
      <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 26, color: "#fff", marginBottom: 10 }}>
        {isTrial ? "Your Free Trial Has Ended" : "Subscription Expired"}
      </h1>
      <p style={{ color: C.muted, fontSize: 14, maxWidth: 420, lineHeight: 1.7, marginBottom: 28 }}>
        {isTrial
          ? "Your 7-day free trial has ended. To continue using MailForge, please contact your administrator to subscribe to a monthly or yearly plan."
          : "Your subscription has expired. Please contact your administrator to renew access."
        }
      </p>
      <div className="card" style={{ padding: "20px 28px", marginBottom: 24, maxWidth: 380, width: "100%" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>Available Plans</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 4 }}>Monthly</div>
            <div style={{ fontSize: 11, color: C.muted }}>Billed every 30 days</div>
          </div>
          <div style={{ background: "#1e1b4b", border: `1px solid ${C.purple}55`, borderRadius: 8, padding: "14px 16px", position: "relative" }}>
            <div style={{ position: "absolute", top: -8, right: 8, background: C.purple, color: "#fff", fontSize: 9, padding: "2px 8px", borderRadius: 20 }}>SAVE MORE</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: "#fff", marginBottom: 4 }}>Yearly</div>
            <div style={{ fontSize: 11, color: C.muted }}>Billed annually</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 14, padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
          Contact your administrator with your Tenant ID to subscribe.
        </div>
      </div>
      <button className="btn btn-ghost" onClick={onLogout}>Sign out</button>
    </div>
  );
}

// ── PENDING SCREEN ────────────────────────────────────────────────────────────
function PendingScreen({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card fade" style={{ padding: 40, maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 8 }}>Request submitted!</h2>
        <p style={{ color: C.muted, fontSize: 13, lineHeight: 1.7 }}>Your account is pending admin approval. You'll receive an email once it's approved.</p>
        <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={onBack}>Back to login</button>
      </div>
    </div>
  );
}

// ── SIGNUP PAGE ───────────────────────────────────────────────────────────────
function SignupPage({ onGoLogin }) {
  const [step, setStep]       = useState("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [creds, setCreds]     = useState({ email: "", password: "" });
  const [fbToken, setFbToken] = useState(null);
  const [googleName, setGoogleName] = useState("");
  const setCred = k => e => setCreds(f => ({ ...f, [k]: e.target.value }));

  const submitCredentials = async () => {
    setError(null); setLoading(true);
    try {
      const userCred = await signUpWithEmail(creds.email, creds.password);
      const token = await userCred.user.getIdToken();
      await apiFetch("POST", "/auth/me", null, token);
      setFbToken(token); setStep("profile");
    } catch (err) {
      setError(err.code === "auth/email-already-in-use" ? "An account with this email already exists." : err.code === "auth/weak-password" ? "Password must be at least 6 characters." : err.message);
    } finally { setLoading(false); }
  };

  const submitGoogle = async () => {
    setError(null); setLoading(true);
    try {
      const userCred = await signInWithGoogle();
      const token = await userCred.user.getIdToken();
      const { data } = await apiFetch("POST", "/auth/me", null, token);
      if (data.status === "active") return;
      setFbToken(token); setGoogleName(data.name || userCred.user.displayName || "");
      setStep("profile");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const submitProfile = async (profileForm) => {
    setError(null); setLoading(true);
    try {
      const { ok, data } = await apiFetch("POST", "/auth/register-profile", { name: profileForm.name || googleName, company: profileForm.company, phone: profileForm.phone }, fbToken);
      if (!ok) { setError(data.error); return; }
      await logout();
      setStep("pending");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  if (step === "pending") return <PendingScreen onBack={onGoLogin} />;
  const isGoogleFlow = !!googleName;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fade" style={{ width: "100%", maxWidth: 440 }}>
        <Logo />
        <div className="card" style={{ padding: 32 }}>
          <StepIndicator current={step === "credentials" ? 0 : 1} total={2} labels={["Account", "Profile"]} />

          {step === "credentials" && <>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 4 }}>Request Access</h1>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Submit your details — admin will review and approve.</p>
            <button className="btn btn-google" style={{ width: "100%" }} onClick={submitGoogle} disabled={loading}><GoogleIcon /> Continue with Google</button>
            <div className="divider">or sign up with email</div>
            <div style={{ marginBottom: 12 }}><Label required>Work Email</Label><input className="input" type="email" placeholder="you@company.com" value={creds.email} onChange={setCred("email")} /></div>
            <div style={{ marginBottom: 20 }}><Label required>Password</Label><input className="input" type="password" placeholder="Min. 6 characters" value={creds.password} onChange={setCred("password")} onKeyDown={e => e.key === "Enter" && submitCredentials()} /></div>
            {error && <Alert type="error">{error}</Alert>}
            <button className="btn btn-primary" style={{ width: "100%", padding: "11px", marginTop: error ? 12 : 0 }} onClick={submitCredentials} disabled={loading || !creds.email || !creds.password}>{loading ? "Creating account…" : "Continue →"}</button>
            <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: C.muted }}>Already have an account? <button onClick={onGoLogin} style={{ background: "none", border: "none", color: C.purpleHi, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>Log in</button></div>
          </>}

          {step === "profile" && <>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 4 }}>Complete Your Profile</h1>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{isGoogleFlow ? `Signed in as ${googleName}. Just a few more details.` : "Almost done — tell us about yourself."}</p>
            {isGoogleFlow && <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 16 }}><GoogleIcon /><span style={{ fontSize: 13, color: C.sub }}>{googleName}</span><span style={{ marginLeft: "auto", fontSize: 11, color: C.green }}>✓ verified</span></div>}
            <ProfileForm initial={{ name: googleName }} onSubmit={submitProfile} loading={loading} error={error} submitLabel="Submit Request →" showNameField={!isGoogleFlow} />
            <button style={{ background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", marginTop: 14, display: "block", textAlign: "center", width: "100%" }} onClick={() => { setStep("credentials"); setFbToken(null); setGoogleName(""); setError(null); }}>← Back</button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ── LOGIN PAGE ────────────────────────────────────────────────────────────────
function LoginPage({ onGoSignup }) {
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [pendingMsg, setPendingMsg] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleResult = async (getToken) => {
    setError(null); setPendingMsg(null); setLoading(true);
    try {
      const token = await getToken();
      const { data } = await apiFetch("POST", "/auth/me", null, token);
      if (data.status === "pending") { setPendingMsg("Your account is pending admin approval."); await logout(); }
      else if (data.status === "rejected") { setError(`Account not approved${data.rejectionReason ? ": " + data.rejectionReason : "."}`); await logout(); }
    } catch (err) {
      setError(err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" ? "Invalid email or password." : err.message);
    } finally { setLoading(false); }
  };

  const submitEmail  = () => handleResult(async () => { const c = await signInWithEmail(form.email, form.password); return c.user.getIdToken(); });
  const submitGoogle = () => handleResult(async () => { const c = await signInWithGoogle(); return c.user.getIdToken(); });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fade" style={{ width: "100%", maxWidth: 400 }}>
        <Logo />
        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", marginBottom: 4 }}>Welcome back</h1>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Sign in to your dashboard.</p>
          <button className="btn btn-google" style={{ width: "100%" }} onClick={submitGoogle} disabled={loading}><GoogleIcon /> Continue with Google</button>
          <div className="divider">or</div>
          <div style={{ marginBottom: 12 }}><Label>Email</Label><input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} onKeyDown={e => e.key === "Enter" && submitEmail()} /></div>
          <div style={{ marginBottom: 20 }}><Label>Password</Label><input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} onKeyDown={e => e.key === "Enter" && submitEmail()} /></div>
          {error      && <Alert type="error">{error}</Alert>}
          {pendingMsg && <Alert type="info">⏳ {pendingMsg}</Alert>}
          <button className="btn btn-primary" style={{ width: "100%", padding: "11px", marginTop: (error || pendingMsg) ? 12 : 0 }} onClick={submitEmail} disabled={loading || !form.email || !form.password}>{loading ? "Signing in…" : "Sign In →"}</button>
          <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: C.muted }}>Don't have an account? <button onClick={onGoSignup} style={{ background: "none", border: "none", color: C.purpleHi, fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>Request access</button></div>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────────────────────
function AdminDashboard({ onBack }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("mf_admin_key") || "");
  const [authed, setAuthed]     = useState(false);
  const [tenants, setTenants]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [filter, setFilter]     = useState("pending");
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);
  const [rejectModal, setRejectModal]   = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [subModal, setSubModal]         = useState(null); // tenantId
  const [subPlan, setSubPlan]           = useState("monthly");

  const load = async (key = adminKey, f = filter) => {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      apiFetch("GET", `/admin/tenants?status=${f}`, null, key),
      apiFetch("GET", "/admin/stats", null, key),
    ]);
    setLoading(false);
    if (!tRes.ok) { setAuthed(false); return; }
    setAuthed(true);
    setTenants(tRes.data.tenants || []);
    if (sRes.ok) setStats(sRes.data);
  };

  const login = async () => { localStorage.setItem("mf_admin_key", adminKey); await load(adminKey); };
  useEffect(() => { if (authed) load(adminKey, filter); }, [filter]);

  const approve = async (id) => {
    setMsg(null);
    const { ok, data } = await apiFetch("POST", `/admin/tenants/${id}/approve`, {}, adminKey);
    setMsg(ok ? { type: "success", text: `✓ Approved! 7-day trial started. Email sent.` } : { type: "error", text: data.error });
    load();
  };

  const reject = async () => {
    await apiFetch("POST", `/admin/tenants/${rejectModal}/reject`, { reason: rejectReason }, adminKey);
    setRejectModal(null); setRejectReason("");
    setMsg({ type: "success", text: "✓ Rejected." });
    load();
  };

  const subscribe = async () => {
    const { ok, data } = await apiFetch("POST", `/admin/tenants/${subModal}/subscribe`, { plan: subPlan }, adminKey);
    setSubModal(null);
    setMsg(ok ? { type: "success", text: `✓ ${subPlan} subscription activated. Email sent.` } : { type: "error", text: data.error });
    load();
  };

  const subStatusBadge = (t) => {
    const s = t.subscriptionStatus;
    const label = t._plan?.label || s;
    const color = s === "active" ? C.green : s === "trial" ? C.amber : s === "expired" || s === "cancelled" ? C.red : C.muted;
    const bg    = s === "active" ? "#14532d33" : s === "trial" ? "#78350f33" : s === "expired" || s === "cancelled" ? "#3f121233" : C.border;
    return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 10px", borderRadius: 20, background: bg, color }}>{label}</span>;
  };

  if (!authed) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card fade" style={{ padding: 32, width: "100%", maxWidth: 380 }}>
        <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 20 }}>🔐 Admin Access</h2>
        <Label>Admin Key</Label>
        <input className="input" type="password" placeholder="ADMIN_KEY from .env" value={adminKey} onChange={e => setAdminKey(e.target.value)} onKeyDown={e => e.key === "Enter" && login()} />
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={login}>Enter</button>
        <button className="btn btn-ghost"   style={{ width: "100%", marginTop: 8  }} onClick={onBack}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo size="sm" /><span style={{ fontSize: 10, background: C.border, color: C.purple, padding: "2px 8px", borderRadius: 20, marginLeft: 4 }}>Admin</span></div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onBack}>← User view</button>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }} className="fade">
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 24, color: "#fff", marginBottom: 4 }}>Tenant Management</h1>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>Approve requests and manage subscriptions.</p>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 10, marginBottom: 24 }}>
            {[
              ["Total",      stats.total,      C.sub],
              ["Pending",    stats.pending,     C.amber],
              ["Active",     stats.active,      C.green],
              ["Rejected",   stats.rejected,    C.red],
              ["On Trial",   stats.onTrial,     C.amber],
              ["Subscribed", stats.subscribed,  C.green],
              ["Expired",    stats.expired,     C.red],
            ].map(([label, val, color]) => (
              <div key={label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {["pending", "active", "rejected"].map(f => (
            <button key={f} className={`tab ${filter === f ? "active" : "inactive"}`} onClick={() => setFilter(f)} style={{ textTransform: "capitalize" }}>{f}</button>
          ))}
          <button className="btn btn-ghost" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => load()}>↻ Refresh</button>
        </div>

        {msg && <Alert type={msg.type}>{msg.text}</Alert>}

        <div className="card" style={{ marginTop: 12 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : tenants.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>No {filter} tenants.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Name / Company", "Email", "Phone", "Subscription", "Requested", "Actions"].map(h => (
                    <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map((t, i) => (
                  <tr key={t.id} className="row-hover" style={{ borderBottom: i < tenants.length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {t.photoUrl
                          ? <img src={t.photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                          : <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: C.muted }}>{(t.name || "?")[0].toUpperCase()}</div>
                        }
                        <div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</div>
                          {t.company && <div style={{ fontSize: 11, color: C.muted }}>{t.company}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: C.sub }}>{t.email}</td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: t.phone ? C.sub : C.muted, fontStyle: t.phone ? "normal" : "italic" }}>{t.phone || "—"}</td>
                    <td style={{ padding: "13px 16px" }}>{t.status === "active" ? subStatusBadge(t) : <span style={{ fontSize: 11, color: C.muted }}>—</span>}</td>
                    <td style={{ padding: "13px 16px", fontSize: 12, color: C.muted }}>{new Date(t.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td style={{ padding: "13px 16px" }}>
                      {t.status === "pending" && (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-success" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => approve(t.id)}>✓ Approve</button>
                          <button className="btn btn-danger"  style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => { setRejectModal(t.id); setRejectReason(""); }}>✕ Reject</button>
                        </div>
                      )}
                      {t.status === "active" && (
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: "5px 14px" }} onClick={() => { setSubModal(t.id); setSubPlan("monthly"); }}>
                          {t.subscriptionStatus === "active" ? "↻ Renew" : "Subscribe"}
                        </button>
                      )}
                      {t.status === "rejected" && <span style={{ fontSize: 12, color: C.red }}>Rejected</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card fade" style={{ padding: 28, width: 420 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 12 }}>Reject Request</h3>
            <Label>Reason (optional — user will see this)</Label>
            <textarea className="input" rows={3} placeholder="e.g. Unable to verify business details." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={reject}>Confirm Reject</button>
              <button className="btn btn-ghost"  style={{ flex: 1 }} onClick={() => setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribe modal */}
      {subModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="card fade" style={{ padding: 28, width: 420 }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", marginBottom: 6 }}>Activate Subscription</h3>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Select plan for this tenant. A confirmation email will be sent.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {["monthly", "yearly"].map(p => (
                <button key={p} onClick={() => setSubPlan(p)} style={{ padding: "14px", borderRadius: 8, border: `2px solid ${subPlan === p ? C.purple : C.border}`, background: subPlan === p ? "#1e1b4b" : C.bg, color: subPlan === p ? "#fff" : C.muted, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, marginBottom: 4, textTransform: "capitalize" }}>{p}</div>
                  <div style={{ fontSize: 11 }}>{p === "monthly" ? "30 days" : "365 days"}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={subscribe}>Activate {subPlan}</button>
              <button className="btn btn-ghost"   style={{ flex: 1 }} onClick={() => setSubModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TENANT DASHBOARD ──────────────────────────────────────────────────────────
function Dashboard({ tenant, firebaseUser, billing, onLogout }) {
  const isExpired = billing?.subscriptionStatus === "expired" || billing?.subscriptionStatus === "cancelled";

  if (isExpired) return <ExpiredWall billing={billing} onLogout={onLogout} />;

  return (
    <div style={{ minHeight: "100vh" }}>
      <SubscriptionBanner billing={billing} />
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 58 }}>
        <Logo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {firebaseUser?.photoURL && <img src={firebaseUser.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: "50%" }} />}
          <span style={{ fontSize: 12, color: C.muted }}>{tenant?.email}</span>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onLogout}>Sign out</button>
        </div>
      </div>
      <div style={{ padding: "60px 32px", textAlign: "center" }} className="fade">
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: "#fff", marginBottom: 8 }}>
          Welcome, {tenant?.name}!
        </h1>
        <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>
          Tenant ID: <code style={{ color: C.purpleHi }}>{tenant?.tenantId}</code>
        </p>
        <div className="card" style={{ display: "inline-block", padding: "12px 24px", fontSize: 13, color: C.sub }}>
          Use your API key or Firebase ID token →{" "}
          <code style={{ color: C.purpleHi }}>Authorization: Bearer &lt;token&gt;</code>
        </div>
      </div>
    </div>
  );
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]             = useState("login");
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [tenant, setTenant]         = useState(null);
  const [billing, setBilling]       = useState(null);

  const fetchBilling = useCallback(async () => {
    const { ok, data } = await apiFetch("GET", "/billing/status");
    if (ok) setBilling(data);
  }, []);

  useEffect(() => {
    return onAuth(async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        const { ok, data } = await apiFetch("POST", "/auth/me", null, token);
        if (ok && data.status === "active") {
          setTenant(data);
          setPage("dashboard");
          // Fetch billing info
          const { ok: bOk, data: bData } = await apiFetch("GET", "/billing/status", null, token);
          if (bOk) setBilling(bData);
        } else if (ok && data.status === "pending") {
          await logout();
        }
      } else {
        setTenant(null);
        setBilling(null);
        if (page === "dashboard") setPage("login");
      }
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    setTenant(null);
    setBilling(null);
    setPage("login");
  };

  if (firebaseUser === undefined) return (
    <>
      <style>{css}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      {page !== "admin" && page !== "dashboard" && (
        <div style={{ position: "fixed", top: 12, right: 16, zIndex: 50 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 12px" }} onClick={() => setPage("admin")}>Admin ↗</button>
        </div>
      )}
      {page === "signup"    && <SignupPage    onGoLogin={() => setPage("login")} />}
      {page === "login"     && <LoginPage     onGoSignup={() => setPage("signup")} />}
      {page === "admin"     && <AdminDashboard onBack={() => setPage("login")} />}
      {page === "dashboard" && tenant && <Dashboard tenant={tenant} firebaseUser={firebaseUser} billing={billing} onLogout={handleLogout} />}
    </>
  );
}
