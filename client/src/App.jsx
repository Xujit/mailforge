import { useState, useEffect, useCallback } from "react";

const API = "/api"; // proxied to localhost:3000

// ── tiny fetch helper ─────────────────────────────────────────────────────────
async function apiFetch(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ── colour tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       "#07070f",
  surface:  "#0f0f1a",
  border:   "#1c1c2e",
  purple:   "#7c3aed",
  purpleHi: "#a78bfa",
  green:    "#22c55e",
  amber:    "#f59e0b",
  red:      "#ef4444",
  muted:    "#475569",
  text:     "#e2e8f0",
  sub:      "#94a3b8",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.bg}; color: ${C.text}; font-family: 'DM Mono', monospace; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: ${C.bg}; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
  input, textarea, select { font-family: inherit; }
  button { cursor: pointer; font-family: inherit; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: none; border-radius: 8px; font-size: 13px; font-weight: 500;
    padding: 9px 20px; transition: all .18s; white-space: nowrap;
  }
  .btn-primary { background: ${C.purple}; color: #fff; }
  .btn-primary:hover { background: #6d28d9; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: .4; pointer-events: none; }
  .btn-ghost { background: ${C.border}; color: ${C.sub}; }
  .btn-ghost:hover { background: #252540; color: ${C.text}; }
  .btn-danger { background: #3f1212; color: ${C.red}; }
  .btn-danger:hover { background: #5a1a1a; }
  .btn-success { background: #14532d44; color: ${C.green}; border: 1px solid #22c55e33; }
  .btn-success:hover { background: #14532d88; }
  .card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; }
  .input {
    width: 100%; background: ${C.bg}; border: 1px solid ${C.border};
    border-radius: 8px; color: ${C.text}; padding: 10px 14px; font-size: 13px;
    transition: border-color .15s;
  }
  .input:focus { outline: none; border-color: ${C.purple}; }
  .input::placeholder { color: ${C.muted}; }
  .fade { animation: fadeUp .35s ease forwards; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; padding: 3px 10px; border-radius: 20px;
  }
  .badge-pending  { background: #78350f33; color: ${C.amber}; }
  .badge-active   { background: #14532d33; color: ${C.green}; }
  .badge-rejected { background: #3f121233; color: ${C.red}; }
  .row-hover:hover { background: #12122088; }
  .tab { background:none; border:none; padding:7px 16px; border-radius:8px; font-size:13px; transition: all .15s; }
  .tab.active { background: #1a1a2e; color: ${C.purpleHi}; }
  .tab.inactive { color: ${C.muted}; }
  .tab.inactive:hover { color: ${C.text}; }
  .divider { height:1px; background: ${C.border}; margin: 20px 0; }
`;

// ── shared components ─────────────────────────────────────────────────────────
function Label({ children }) {
  return <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{children}</div>;
}

function Alert({ type = "error", children }) {
  const colors = {
    error:   { bg: "#3f121233", border: "#ef444433", color: C.red },
    success: { bg: "#14532d33", border: "#22c55e33", color: C.green },
    info:    { bg: "#1e1b4b",   border: "#4338ca33", color: C.purpleHi },
  }[type];
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: colors.color, marginTop: 12 }}>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNUP PAGE
// ══════════════════════════════════════════════════════════════════════════════
function SignupPage({ onGoLogin }) {
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.email || !form.password || !form.name) return;
    setLoading(true);
    const { ok, data } = await apiFetch("POST", "/auth/register", form);
    setLoading(false);
    setResult({ ok, message: ok ? data.message : data.error });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="fade" style={{ width: "100%", maxWidth: 440 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36, justifyContent: "center" }}>
          <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${C.purple},${C.purpleHi})`, borderRadius: 10, display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>✉</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: "#fff" }}>MailForge</span>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:"#fff", marginBottom:4 }}>Request Access</h1>
          <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>Submit your details — our team will review and approve your account.</p>

          {result ? (
            <>
              <Alert type={result.ok ? "success" : "error"}>{result.message}</Alert>
              {result.ok && (
                <div style={{ marginTop: 20, textAlign: "center", fontSize: 13, color: C.muted }}>
                  Already approved?{" "}
                  <button className="btn btn-ghost" style={{ padding:"4px 12px", fontSize:13 }} onClick={onGoLogin}>Log in</button>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                <div>
                  <Label>Full Name *</Label>
                  <input className="input" placeholder="Jane Doe" value={form.name} onChange={set("name")} />
                </div>
                <div>
                  <Label>Company</Label>
                  <input className="input" placeholder="Acme Inc." value={form.company} onChange={set("company")} />
                </div>
              </div>
              <div style={{ marginBottom:12 }}>
                <Label>Work Email *</Label>
                <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} />
              </div>
              <div style={{ marginBottom:20 }}>
                <Label>Password *</Label>
                <input className="input" type="password" placeholder="Min. 8 characters" value={form.password} onChange={set("password")} />
              </div>

              <button className="btn btn-primary" style={{ width:"100%", padding:"11px" }} onClick={submit} disabled={loading || !form.email || !form.password || !form.name}>
                {loading ? "Submitting…" : "Request Access →"}
              </button>

              <div style={{ marginTop:18, textAlign:"center", fontSize:13, color:C.muted }}>
                Already have an account?{" "}
                <button onClick={onGoLogin} style={{ background:"none",border:"none",color:C.purpleHi,fontSize:13,textDecoration:"underline" }}>Log in</button>
              </div>
            </>
          )}
        </div>

        {/* Trust badges */}
        <div style={{ display:"flex", justifyContent:"center", gap:24, marginTop:24 }}>
          {["Handlebars templates", "Tenant-isolated", "REST API"].map(t => (
            <span key={t} style={{ fontSize:11, color:C.muted }}>✓ {t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
function LoginPage({ onLogin, onGoSignup }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingMsg, setPendingMsg] = useState(null);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(null); setPendingMsg(null);
    setLoading(true);
    const { ok, status, data } = await apiFetch("POST", "/auth/login", form);
    setLoading(false);
    if (ok) return onLogin(data);
    if (status === 403 && data.status === "pending") {
      setPendingMsg("Your account is pending admin approval. You'll get an email when it's ready.");
    } else {
      setError(data.error || "Login failed.");
    }
  };

  const onKey = e => e.key === "Enter" && submit();

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="fade" style={{ width:"100%", maxWidth:400 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:36, justifyContent:"center" }}>
          <div style={{ width:36, height:36, background:`linear-gradient(135deg,${C.purple},${C.purpleHi})`, borderRadius:10, display:"flex",alignItems:"center",justifyContent:"center",fontSize:18 }}>✉</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:"#fff" }}>MailForge</span>
        </div>

        <div className="card" style={{ padding:32 }}>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:"#fff", marginBottom:4 }}>Welcome back</h1>
          <p style={{ fontSize:13, color:C.muted, marginBottom:24 }}>Sign in to your dashboard.</p>

          <div style={{ marginBottom:12 }}>
            <Label>Email</Label>
            <input className="input" type="email" placeholder="you@company.com" value={form.email} onChange={set("email")} onKeyDown={onKey} />
          </div>
          <div style={{ marginBottom:20 }}>
            <Label>Password</Label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} onKeyDown={onKey} />
          </div>

          {error      && <Alert type="error">{error}</Alert>}
          {pendingMsg && <Alert type="info">⏳ {pendingMsg}</Alert>}

          <button className="btn btn-primary" style={{ width:"100%", padding:"11px", marginTop: (error || pendingMsg) ? 12 : 0 }} onClick={submit} disabled={loading || !form.email || !form.password}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <div style={{ marginTop:18, textAlign:"center", fontSize:13, color:C.muted }}>
            Don't have an account?{" "}
            <button onClick={onGoSignup} style={{ background:"none",border:"none",color:C.purpleHi,fontSize:13,textDecoration:"underline" }}>Request access</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function AdminDashboard({ onBack }) {
  const [adminKey, setAdminKey] = useState(localStorage.getItem("mf_admin_key") || "");
  const [authed, setAuthed] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // tenantId
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async (key = adminKey) => {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      apiFetch("GET", `/admin/tenants?status=${filter}`, null, key),
      apiFetch("GET", "/admin/stats", null, key),
    ]);
    setLoading(false);
    if (!tRes.ok) { setAuthed(false); return; }
    setAuthed(true);
    setTenants(tRes.data.tenants || []);
    if (sRes.ok) setStats(sRes.data);
  }, [filter, adminKey]);

  const login = async () => {
    localStorage.setItem("mf_admin_key", adminKey);
    await load(adminKey);
  };

  useEffect(() => { if (authed) load(); }, [filter]);

  const approve = async (tenantId) => {
    setActionMsg(null);
    const { ok, data } = await apiFetch("POST", `/admin/tenants/${tenantId}/approve`, {}, adminKey);
    setActionMsg(ok
      ? { type:"success", text:`✓ Approved! Email sent${data.preview_url ? ` — Preview: ${data.preview_url}` : ""}.` }
      : { type:"error",   text: data.error });
    load();
  };

  const reject = async () => {
    const { ok, data } = await apiFetch("POST", `/admin/tenants/${rejectModal}/reject`, { reason: rejectReason }, adminKey);
    setRejectModal(null); setRejectReason("");
    setActionMsg(ok ? { type:"success", text:"✓ Rejected." } : { type:"error", text: data.error });
    load();
  };

  if (!authed) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div className="fade card" style={{ padding:32, width:"100%", maxWidth:380 }}>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:"#fff", marginBottom:20 }}>🔐 Admin Access</h2>
        <Label>Admin Key</Label>
        <input className="input" type="password" placeholder="ADMIN_KEY from .env" value={adminKey}
          onChange={e => setAdminKey(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()} />
        <button className="btn btn-primary" style={{ width:"100%", marginTop:14 }} onClick={login}>Enter</button>
        <button className="btn btn-ghost" style={{ width:"100%", marginTop:8 }} onClick={onBack}>← Back to login</button>
      </div>
    </div>
  );

  const FILTERS = ["pending","active","rejected"];

  return (
    <div style={{ minHeight:"100vh" }}>
      {/* Header */}
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${C.purple},${C.purpleHi})`, borderRadius:8, display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>✉</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:"#fff" }}>MailForge</span>
          <span style={{ fontSize:10, background:C.border, color:C.purple, padding:"2px 8px", borderRadius:20, marginLeft:4 }}>Admin</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onBack}>← User view</button>
      </div>

      <div style={{ padding:"28px 32px", maxWidth:1000, margin:"0 auto" }}>
        <div className="fade">
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:24, color:"#fff", marginBottom:4 }}>Tenant Approvals</h1>
          <p style={{ color:C.muted, fontSize:13, marginBottom:24 }}>Review and approve access requests.</p>

          {/* Stats */}
          {stats && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
              {[
                { label:"Total",    value:stats.total,    color:C.sub },
                { label:"Pending",  value:stats.pending,  color:C.amber },
                { label:"Active",   value:stats.active,   color:C.green },
                { label:"Rejected", value:stats.rejected, color:C.red },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding:"16px 20px" }}>
                  <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:800, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:16 }}>
            {FILTERS.map(f => (
              <button key={f} className={`tab ${filter===f?"active":"inactive"}`} onClick={() => setFilter(f)}
                style={{ textTransform:"capitalize" }}>{f}</button>
            ))}
            <button className="btn btn-ghost" style={{ marginLeft:"auto", fontSize:12 }} onClick={() => load()}>↻ Refresh</button>
          </div>

          {actionMsg && <Alert type={actionMsg.type}>{actionMsg.text}</Alert>}

          {/* Table */}
          <div className="card" style={{ marginTop:12, overflow:"hidden" }}>
            {loading ? (
              <div style={{ padding:40, textAlign:"center", color:C.muted, fontSize:13 }}>Loading…</div>
            ) : tenants.length === 0 ? (
              <div style={{ padding:40, textAlign:"center", color:C.muted, fontSize:13 }}>No {filter} tenants.</div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${C.border}` }}>
                    {["Name / Company","Email","Requested","Status","Actions"].map(h => (
                      <th key={h} style={{ padding:"11px 18px", textAlign:"left", fontSize:11, color:C.muted, letterSpacing:"0.08em", textTransform:"uppercase", fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, i) => (
                    <tr key={t.tenantId} className="row-hover" style={{ borderBottom: i < tenants.length-1 ? `1px solid ${C.border}` : "none", transition:"background .15s" }}>
                      <td style={{ padding:"13px 18px" }}>
                        <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{t.name}</div>
                        {t.company && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{t.company}</div>}
                      </td>
                      <td style={{ padding:"13px 18px", fontSize:13, color:C.sub }}>{t.email}</td>
                      <td style={{ padding:"13px 18px", fontSize:12, color:C.muted }}>
                        {new Date(t.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}
                      </td>
                      <td style={{ padding:"13px 18px" }}>
                        <span className={`badge badge-${t.status}`}>
                          ● {t.status}
                        </span>
                        {t.rejectionReason && (
                          <div style={{ fontSize:11, color:C.red, marginTop:3 }}>{t.rejectionReason}</div>
                        )}
                      </td>
                      <td style={{ padding:"13px 18px" }}>
                        {t.status === "pending" && (
                          <div style={{ display:"flex", gap:8 }}>
                            <button className="btn btn-success" style={{ fontSize:12, padding:"5px 14px" }} onClick={() => approve(t.tenantId)}>✓ Approve</button>
                            <button className="btn btn-danger"  style={{ fontSize:12, padding:"5px 14px" }} onClick={() => { setRejectModal(t.tenantId); setRejectReason(""); }}>✕ Reject</button>
                          </div>
                        )}
                        {t.status === "active"   && <span style={{ fontSize:12, color:C.green }}>Active</span>}
                        {t.status === "rejected" && <span style={{ fontSize:12, color:C.red }}>Rejected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div className="card fade" style={{ padding:28, width:420 }}>
            <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color:"#fff", marginBottom:12 }}>Reject Request</h3>
            <Label>Reason (optional — user will see this)</Label>
            <textarea className="input" rows={3} placeholder="e.g. Unable to verify business details."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              style={{ resize:"vertical" }} />
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button className="btn btn-danger" style={{ flex:1 }} onClick={reject}>Confirm Reject</button>
              <button className="btn btn-ghost"  style={{ flex:1 }} onClick={() => setRejectModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD (post-login tenant view)
// ══════════════════════════════════════════════════════════════════════════════
function Dashboard({ session, onLogout }) {
  return (
    <div style={{ minHeight:"100vh" }}>
      <div style={{ borderBottom:`1px solid ${C.border}`, padding:"0 32px", display:"flex", alignItems:"center", justifyContent:"space-between", height:58 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, background:`linear-gradient(135deg,${C.purple},${C.purpleHi})`, borderRadius:8, display:"flex",alignItems:"center",justifyContent:"center",fontSize:15 }}>✉</div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:17, color:"#fff" }}>MailForge</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:12, color:C.muted }}>{session.tenant.email}</span>
          <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={onLogout}>Sign out</button>
        </div>
      </div>
      <div style={{ padding:"60px 32px", textAlign:"center" }} className="fade">
        <div style={{ fontSize:48, marginBottom:16 }}>🎉</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:"#fff", marginBottom:8 }}>
          Welcome, {session.tenant.name}!
        </h1>
        <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>Your account is active. Tenant ID: <code style={{ color:C.purpleHi }}>{session.tenant.tenantId}</code></p>
        <div className="card" style={{ display:"inline-block", padding:"12px 24px", fontSize:13, color:C.sub }}>
          Use your API key or JWT to call <code style={{ color:C.purpleHi }}>POST /v1/send</code>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP ROUTER
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // page: "signup" | "login" | "admin" | "dashboard"
  const [page, setPage]       = useState("signup");
  const [session, setSession] = useState(null);

  const handleLogin = (data) => {
    setSession(data);
    setPage("dashboard");
  };

  const handleLogout = () => {
    setSession(null);
    setPage("login");
  };

  return (
    <>
      <style>{css}</style>

      {/* Admin link */}
      {page !== "admin" && page !== "dashboard" && (
        <div style={{ position:"fixed", top:12, right:16, zIndex:50 }}>
          <button className="btn btn-ghost" style={{ fontSize:11, padding:"4px 12px" }} onClick={() => setPage("admin")}>Admin ↗</button>
        </div>
      )}

      {page === "signup"    && <SignupPage    onGoLogin={() => setPage("login")} />}
      {page === "login"     && <LoginPage     onLogin={handleLogin} onGoSignup={() => setPage("signup")} />}
      {page === "admin"     && <AdminDashboard onBack={() => setPage("login")} />}
      {page === "dashboard" && session && <Dashboard session={session} onLogout={handleLogout} />}
    </>
  );
}
