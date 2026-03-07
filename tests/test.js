// tests/test.js — MailForge v3 integration tests (approval flow)
const http = require("http");

let passed = 0, failed = 0;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin_changeme_before_production";

async function req(method, path, body, token) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname:"localhost", port:3000, path, method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data   ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let raw = "";
      res.on("data", c => raw += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

function assert(name, cond, detail = "") {
  if (cond) { console.log(`  ✓  ${name}`); passed++; }
  else { console.error(`  ✗  ${name}${detail ? " → " + detail : ""}`); failed++; }
}

async function run() {
  console.log("\n🧪  MailForge v3 — Approval Flow Tests\n");

  // ── Health ──────────────────────────────────────────────────────────────────
  console.log("── Health ──────────────────────────────────");
  const h = await req("GET", "/health");
  assert("GET /health → 200", h.status === 200);
  assert("Version 3.0.0", h.body.version === "3.0.0");

  // ── Signup (creates pending tenant) ────────────────────────────────────────
  console.log("\n── Signup ──────────────────────────────────");
  const reg = await req("POST", "/auth/register", {
    email: "carol@startup.io", password: "testpass99", name: "Carol", company: "Startup IO"
  });
  assert("Register → 201", reg.status === 201);
  assert("Status is pending", reg.body.status === "pending");
  assert("No token issued yet", !reg.body.access_token);
  assert("Has tenantId", !!reg.body.tenantId);
  const tenantId = reg.body.tenantId;

  const dup = await req("POST", "/auth/register", { email: "carol@startup.io", password: "other123" });
  assert("Duplicate email → 409", dup.status === 409);

  // ── Login blocked while pending ─────────────────────────────────────────────
  console.log("\n── Login gate ──────────────────────────────");
  const loginPending = await req("POST", "/auth/login", { email:"carol@startup.io", password:"testpass99" });
  assert("Login while pending → 403", loginPending.status === 403);
  assert("Status field = pending", loginPending.body.status === "pending");

  // ── Admin: list pending ─────────────────────────────────────────────────────
  console.log("\n── Admin ───────────────────────────────────");
  const listPending = await req("GET", "/admin/tenants?status=pending", null, ADMIN_KEY);
  assert("Admin: list pending → 200", listPending.status === 200);
  assert("Carol is in pending list", listPending.body.tenants?.some(t => t.tenantId === tenantId));

  const badAdmin = await req("GET", "/admin/tenants", null, "wrong_key");
  assert("Bad admin key → 401", badAdmin.status === 401);

  const stats = await req("GET", "/admin/stats", null, ADMIN_KEY);
  assert("Admin: stats → 200", stats.status === 200);
  assert("Pending count >= 1", stats.body.pending >= 1);

  // ── Admin: approve ──────────────────────────────────────────────────────────
  console.log("\n── Approve ─────────────────────────────────");
  const approve = await req("POST", `/admin/tenants/${tenantId}/approve`, {}, ADMIN_KEY);
  assert("Approve → 200", approve.status === 200);
  assert("approved flag true", approve.body.approved === true);
  assert("Tenant status = active", approve.body.tenant?.status === "active");

  // ── Login succeeds after approval ───────────────────────────────────────────
  console.log("\n── Login post-approval ─────────────────────");
  const loginOk = await req("POST", "/auth/login", { email:"carol@startup.io", password:"testpass99" });
  assert("Login → 200", loginOk.status === 200);
  assert("Has access_token", !!loginOk.body.access_token);
  assert("Has refresh_token", !!loginOk.body.refresh_token);
  const jwt = loginOk.body.access_token;
  const refreshTok = loginOk.body.refresh_token;

  // ── Tenant can use the API ──────────────────────────────────────────────────
  console.log("\n── Tenant API access ───────────────────────");
  const templates = await req("GET", "/v1/templates", null, jwt);
  assert("Templates → 200", templates.status === 200);
  assert("Has seeded templates", templates.body.count >= 3);

  const send = await req("POST", "/v1/send", {
    template_id: "otp_code",
    to: "verify@example.com",
    variables: { otp: "482910", expiry_minutes: "10" },
  }, jwt);
  assert("Send → 200", send.status === 200);
  assert("Status delivered", send.body.results?.[0]?.status === "delivered");

  // ── Reject flow ─────────────────────────────────────────────────────────────
  console.log("\n── Reject flow ─────────────────────────────");
  const reg2 = await req("POST", "/auth/register", {
    email: "dave@rejected.com", password: "testpass99", name: "Dave"
  });
  const tid2 = reg2.body.tenantId;

  const reject = await req("POST", `/admin/tenants/${tid2}/reject`, { reason:"Unable to verify business." }, ADMIN_KEY);
  assert("Reject → 200", reject.status === 200);
  assert("Status = rejected", reject.body.tenant?.status === "rejected");

  const loginRejected = await req("POST", "/auth/login", { email:"dave@rejected.com", password:"testpass99" });
  assert("Rejected user login → 403", loginRejected.status === 403);
  assert("Rejection reason surfaced", !!loginRejected.body.reason);

  // ── Token refresh ───────────────────────────────────────────────────────────
  console.log("\n── Token refresh ───────────────────────────");
  const refresh = await req("POST", "/auth/refresh", { refresh_token: refreshTok });
  assert("Refresh → 200", refresh.status === 200);
  assert("New access token", !!refresh.body.access_token);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(45)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log("  🎉  All tests passed!\n");
  else              console.log("  ⚠️   Some tests failed\n");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("Runner error:", e.message); process.exit(1); });
