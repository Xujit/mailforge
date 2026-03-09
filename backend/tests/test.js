// tests/test.js — MailForge v3 Sequelize integration tests

const http = require("http");

let passed = 0, failed = 0;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin_changeme";

let tenantAToken = null, tenantBToken = null, tenantAApiKey = null;
let tenantAId = null, tenantBId = null;

async function req(method, path, body, token) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: "localhost", port: 3000, path, method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data  ? { "Content-Length": Buffer.byteLength(data) } : {}),
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
  console.log("\n🧪  MailForge v3 — Sequelize + SQLite Tests\n");

  // ── Health ──────────────────────────────────────────────────────────────────
  console.log("── Health ──────────────────────────────────");
  const h = await req("GET", "/health");
  assert("GET /health → 200", h.status === 200);
  assert("DB is sqlite", h.body.db === "sqlite");

  // ── Register ────────────────────────────────────────────────────────────────
  console.log("\n── Register ────────────────────────────────");
  const regA = await req("POST", "/auth/register", { email: "alice@acme.com", password: "testpass99", name: "Alice", company: "Acme" });
  assert("Tenant A registers → 201", regA.status === 201);
  assert("Status is pending", regA.body.status === "pending");
  assert("No token issued yet", !regA.body.access_token);
  tenantAId = regA.body.tenantId;

  const regB = await req("POST", "/auth/register", { email: "bob@widgets.io", password: "securepass99", name: "Bob" });
  assert("Tenant B registers → 201", regB.status === 201);
  tenantBId = regB.body.tenantId;

  const dup = await req("POST", "/auth/register", { email: "alice@acme.com", password: "other123x" });
  assert("Duplicate email → 409", dup.status === 409);

  const shortPw = await req("POST", "/auth/register", { email: "x@x.com", password: "short" });
  assert("Short password → 400", shortPw.status === 400);

  // ── Login blocked while pending ─────────────────────────────────────────────
  console.log("\n── Login gate ──────────────────────────────");
  const loginPending = await req("POST", "/auth/login", { email: "alice@acme.com", password: "testpass99" });
  assert("Login while pending → 403", loginPending.status === 403);
  assert("Status = pending", loginPending.body.status === "pending");

  // ── Admin ────────────────────────────────────────────────────────────────────
  console.log("\n── Admin ───────────────────────────────────");
  const stats = await req("GET", "/admin/stats", null, ADMIN_KEY);
  assert("GET /admin/stats → 200", stats.status === 200);
  assert("pending >= 2", stats.body.pending >= 2);

  const listPending = await req("GET", "/admin/tenants?status=pending", null, ADMIN_KEY);
  assert("List pending → 200", listPending.status === 200);
  assert("Alice in pending list", listPending.body.tenants?.some(t => t.id === tenantAId));
  assert("passwordHash not exposed", !listPending.body.tenants?.[0]?.passwordHash);

  const badAdmin = await req("GET", "/admin/tenants", null, "wrong_key");
  assert("Bad admin key → 401", badAdmin.status === 401);

  // ── Approve Tenant A ─────────────────────────────────────────────────────────
  console.log("\n── Approve ─────────────────────────────────");
  const approveA = await req("POST", `/admin/tenants/${tenantAId}/approve`, {}, ADMIN_KEY);
  assert("Approve A → 200", approveA.status === 200);
  assert("Status = active", approveA.body.tenant?.status === "active");
  assert("Email sent flag", approveA.body.email_sent === true || approveA.body.email_sent === false); // either is ok

  // ── Login after approval ─────────────────────────────────────────────────────
  console.log("\n── Login post-approval ─────────────────────");
  const loginA = await req("POST", "/auth/login", { email: "alice@acme.com", password: "testpass99" });
  assert("Login → 200", loginA.status === 200);
  assert("Has access_token", !!loginA.body.access_token);
  assert("Has refresh_token", !!loginA.body.refresh_token);
  tenantAToken = loginA.body.access_token;
  const refreshTok = loginA.body.refresh_token;

  // ── Templates ────────────────────────────────────────────────────────────────
  console.log("\n── Templates ───────────────────────────────");
  const tList = await req("GET", "/v1/templates", null, tenantAToken);
  assert("List templates → 200", tList.status === 200);
  assert("Has 3 seeded templates", tList.body.count === 3);

  const tCreate = await req("POST", "/v1/templates", {
    id: "promo_blast",
    subject: "Special offer for {{first_name}}!",
    html_body: "<p>Hi {{first_name}}, use code <b>{{promo_code}}</b>!</p>",
  }, tenantAToken);
  assert("Create template → 201", tCreate.status === 201);
  assert("Variables auto-detected", tCreate.body.variables.includes("first_name"));

  const tGet = await req("GET", "/v1/templates/promo_blast", null, tenantAToken);
  assert("GET template → 200", tGet.status === 200);

  const tUpdate = await req("PUT", "/v1/templates/promo_blast", {
    subject: "Updated: {{first_name}} — act now!",
    html_body: "<p>Updated body {{first_name}} {{promo_code}}</p>",
  }, tenantAToken);
  assert("PUT template → 200", tUpdate.status === 200);

  // ── Tenant isolation ─────────────────────────────────────────────────────────
  console.log("\n── Tenant isolation ────────────────────────");
  const approveB = await req("POST", `/admin/tenants/${tenantBId}/approve`, {}, ADMIN_KEY);
  assert("Approve B → 200", approveB.status === 200);
  const loginB = await req("POST", "/auth/login", { email: "bob@widgets.io", password: "securepass99" });
  tenantBToken = loginB.body.access_token;

  const bTemplates = await req("GET", "/v1/templates", null, tenantBToken);
  assert("Tenant B has own templates", bTemplates.body.count === 3);

  const bGetA = await req("GET", "/v1/templates/promo_blast", null, tenantBToken);
  assert("Tenant B cannot see A's template → 404", bGetA.status === 404);

  // ── API Keys ──────────────────────────────────────────────────────────────────
  console.log("\n── API Keys ────────────────────────────────");
  const keyList = await req("GET", "/v1/keys", null, tenantAToken);
  assert("List keys → 200", keyList.status === 200);
  assert("Has default key from approval", keyList.body.count >= 1);

  const newKey = await req("POST", "/v1/keys", { label: "CI Pipeline", scopes: ["send"] }, tenantAToken);
  assert("Create key → 201", newKey.status === 201);
  assert("Key starts with mk_live_", newKey.body.key?.startsWith("mk_live_"));
  tenantAApiKey = newKey.body.key;

  // ── Send via API key ──────────────────────────────────────────────────────────
  console.log("\n── Send ────────────────────────────────────");
  const sendKey = await req("POST", "/v1/send", {
    template_id: "welcome_email",
    to: "newuser@example.com",
    variables: { name: "Alice", login_url: "https://app.example.com", tenant_id: tenantAId },
  }, tenantAApiKey);
  assert("Send via API key → 200", sendKey.status === 200);
  assert("Status delivered", sendKey.body.results?.[0]?.status === "delivered");

  const sendJwt = await req("POST", "/v1/send", {
    template_id: "otp_code",
    to: ["a@test.com", "b@test.com"],
    variables: { otp: "482910", expiry_minutes: "10" },
  }, tenantAToken);
  assert("Multi-recipient via JWT → 200", sendJwt.status === 200);
  assert("Two results", sendJwt.body.results?.length === 2);

  const sendBadTemplate = await req("POST", "/v1/send", { template_id: "doesnt_exist", to: "x@x.com" }, tenantAToken);
  assert("Unknown template → 404", sendBadTemplate.status === 404);

  const crossTenant = await req("POST", "/v1/send", {
    template_id: "promo_blast", to: "x@x.com",
  }, tenantBToken);
  assert("Cross-tenant template blocked → 404", crossTenant.status === 404);

  // ── Logs ─────────────────────────────────────────────────────────────────────
  console.log("\n── Logs ────────────────────────────────────");
  const logsA = await req("GET", "/v1/logs", null, tenantAToken);
  assert("Logs → 200", logsA.status === 200);
  assert("Has log entries", logsA.body.count >= 3);

  const logsB = await req("GET", "/v1/logs", null, tenantBToken);
  assert("Tenant B logs isolated (0)", logsB.body.count === 0);

  const logId = logsA.body.logs?.[0]?.id;
  if (logId) {
    const logDetail = await req("GET", `/v1/logs/${logId}`, null, tenantAToken);
    assert("GET /v1/logs/:id → 200", logDetail.status === 200);
  }

  // ── Token refresh ─────────────────────────────────────────────────────────────
  console.log("\n── Token refresh ───────────────────────────");
  const refreshed = await req("POST", "/auth/refresh", { refresh_token: refreshTok });
  assert("Refresh → 200", refreshed.status === 200);
  assert("New access token", !!refreshed.body.access_token);
  assert("Token rotated (new refresh token)", refreshed.body.refresh_token !== refreshTok);

  const reusedRefresh = await req("POST", "/auth/refresh", { refresh_token: refreshTok });
  assert("Old refresh token rejected → 401", reusedRefresh.status === 401);

  // ── Reject flow ───────────────────────────────────────────────────────────────
  console.log("\n── Reject ──────────────────────────────────");
  const regC = await req("POST", "/auth/register", { email: "charlie@rejected.com", password: "testpass99", name: "Charlie" });
  const rejectC = await req("POST", `/admin/tenants/${regC.body.tenantId}/reject`, { reason: "Could not verify business." }, ADMIN_KEY);
  assert("Reject → 200", rejectC.status === 200);

  const loginC = await req("POST", "/auth/login", { email: "charlie@rejected.com", password: "testpass99" });
  assert("Rejected user login → 403", loginC.status === 403);
  assert("Rejection reason surfaced", loginC.body.reason === "Could not verify business.");

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(45)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log("  🎉  All tests passed!\n");
  else              console.log("  ⚠️   Some tests failed\n");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("Runner error:", e.message); process.exit(1); });
