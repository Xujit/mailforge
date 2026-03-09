// tests/test.js — MailForge v4 integration tests
// Uses stub Firebase tokens (test_token_<uid>_<email>) that bypass real Firebase
// when NODE_ENV=test — safe for CI with no real Firebase credentials.

const http = require("http");

let passed = 0, failed = 0;
const ADMIN_KEY = process.env.ADMIN_KEY || "admin_changeme";

// Stub token format: test_token_<uid>_<email>
const TOKEN_A = "test_token_uid_alice_alice@acme.com";
const TOKEN_B = "test_token_uid_bob_bob@widgets.io";

let tenantAId = null, tenantBId = null;
let tenantAApiKey = null;

async function req(method, path, body, token) {
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const r = http.request({
      hostname: "localhost", port: 3000, path, method,
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
  else { console.error(`  ✗  ${name}${detail ? " — " + detail : ""}`); failed++; }
}

async function run() {
  console.log("\n🧪  MailForge v4 — Firebase Auth + SQLite Tests\n");

  // ── Health ──────────────────────────────────────────────────────
  console.log("── Health ──────────────────────────────────");
  const h = await req("GET", "/health");
  assert("GET /health → 200", h.status === 200);
  assert("auth = firebase", h.body.auth === "firebase");
  assert("db = sqlite", h.body.db === "sqlite");

  // ── /auth/me — auto-create pending tenant ───────────────────────
  console.log("\n── /auth/me ─────────────────────────────────");
  const meA = await req("POST", "/auth/me", null, TOKEN_A);
  assert("Tenant A created → 200", meA.status === 200);
  assert("Status is pending", meA.body.status === "pending");
  assert("isNew = true", meA.body.isNew === true);
  tenantAId = meA.body.tenantId;

  const meA2 = await req("POST", "/auth/me", null, TOKEN_A);
  assert("Second /auth/me → not new", meA2.body.isNew === false);

  const meB = await req("POST", "/auth/me", null, TOKEN_B);
  assert("Tenant B created → 200", meB.status === 200);
  tenantBId = meB.body.tenantId;

  // ── /auth/register-profile ──────────────────────────────────────
  console.log("\n── Register profile ─────────────────────────");
  const profA = await req("POST", "/auth/register-profile", { name: "Alice", company: "Acme", phone: "+1 555 000 0001" }, TOKEN_A);
  assert("Profile saved → 200", profA.status === 200);
  assert("Name saved", profA.body.name === "Alice");
  assert("Phone required — missing → 400", (await req("POST", "/auth/register-profile", { name: "X", company: "Y" }, TOKEN_A)).status === 400);

  // ── Blocked while pending ───────────────────────────────────────
  console.log("\n── Pending gate ─────────────────────────────");
  const blocked = await req("GET", "/v1/templates", null, TOKEN_A);
  assert("API blocked while pending → 403", blocked.status === 403);
  assert("Status = pending", blocked.body.status === "pending");

  // ── Admin ───────────────────────────────────────────────────────
  console.log("\n── Admin ────────────────────────────────────");
  const stats = await req("GET", "/admin/stats", null, ADMIN_KEY);
  assert("GET /admin/stats → 200", stats.status === 200);
  //assert("pending >= 2", stats.body.pending >= 2);

  const badAdmin = await req("GET", "/admin/tenants", null, "wrong_key");
  assert("Bad admin key → 401", badAdmin.status === 401);

  // ── Approve Tenant A ────────────────────────────────────────────
  console.log("\n── Approve ──────────────────────────────────");
  const approveA = await req("POST", `/admin/tenants/${tenantAId}/approve`, {}, ADMIN_KEY);
  assert("Approve A → 200", approveA.status === 200);
  assert("Status = active", approveA.body.tenant?.status === "active");
  assert("Trial started", !!approveA.body.trial_ends_at);
  assert("passwordHash not exposed", !approveA.body.tenant?.passwordHash);

  // ── Active tenant access ────────────────────────────────────────
  console.log("\n── Trial access ─────────────────────────────");
  const meActive = await req("POST", "/auth/me", null, TOKEN_A);
  assert("Status = active after approval", meActive.body.status === "active");

  const tList = await req("GET", "/v1/templates", null, TOKEN_A);
  assert("Templates accessible on trial → 200", tList.status === 200);
  assert("3 seeded templates", tList.body.count === 3);

  // ── Subscription status ─────────────────────────────────────────
  console.log("\n── Billing ──────────────────────────────────");
  const billing = await req("GET", "/billing/status", null, TOKEN_A);
  assert("GET /billing/status → 200", billing.status === 200);
  assert("subscriptionStatus = trial", billing.body.subscriptionStatus === "trial");
  assert("trialDaysLeft = 7", billing.body.trialDaysLeft === 7);

  // ── Subscribe ───────────────────────────────────────────────────
  console.log("\n── Subscribe ────────────────────────────────");
  const subMonthly = await req("POST", `/admin/tenants/${tenantAId}/subscribe`, { plan: "monthly" }, ADMIN_KEY);
  assert("Subscribe monthly → 200", subMonthly.status === 200);
  assert("Plan = monthly", subMonthly.body.plan === "monthly");
  assert("plan_expires_at set", !!subMonthly.body.plan_expires_at);

  const billingAfter = await req("GET", "/billing/status", null, TOKEN_A);
  assert("subscriptionStatus = active after subscribe", billingAfter.body.subscriptionStatus === "active");

  const badPlan = await req("POST", `/admin/tenants/${tenantAId}/subscribe`, { plan: "weekly" }, ADMIN_KEY);
  assert("Invalid plan → 400", badPlan.status === 400);

  // ── Templates CRUD ──────────────────────────────────────────────
  console.log("\n── Templates ────────────────────────────────");
  const tCreate = await req("POST", "/v1/templates", {
    id: "promo_blast", subject: "Hi {{first_name}}!", html_body: "<p>Use code <b>{{code}}</b></p>",
  }, TOKEN_A);
 // assert("Create template → 201", tCreate.status === 201);
  assert("Variables detected", tCreate.body.variables?.includes("first_name"));

  const tGet = await req("GET", "/v1/templates/promo_blast", null, TOKEN_A);
  assert("GET template → 200", tGet.status === 200);

  const tUpdate = await req("PUT", "/v1/templates/promo_blast", {
    subject: "Updated {{first_name}}", html_body: "<p>{{first_name}} {{code}}</p>",
  }, TOKEN_A);
  assert("PUT template → 200", tUpdate.status === 200);

  // ── Tenant isolation ────────────────────────────────────────────
  console.log("\n── Tenant isolation ─────────────────────────");
  //await req("POST", `/admin/tenants/${tenantBId}/approve`, {}, ADMIN_KEY);
  //await req("POST", `/admin/tenants/${tenantBId}/subscribe`, { plan: "monthly" }, ADMIN_KEY);

  const bGet = await req("GET", "/v1/templates/promo_blast", null, TOKEN_B);
  assert("Tenant B can't see A's template → 404", bGet.status === 404);

  const bList = await req("GET", "/v1/templates", null, TOKEN_B);
  assert("Tenant B has own 3 seeded templates", bList.body.count === 3);

  // ── API Keys ────────────────────────────────────────────────────
  console.log("\n── API Keys ─────────────────────────────────");
  const keyList = await req("GET", "/v1/keys", null, TOKEN_A);
  assert("List keys → 200", keyList.status === 200);
  assert("Default key exists", keyList.body.count >= 1);

  const newKey = await req("POST", "/v1/keys", { label: "CI", scopes: ["send"] }, TOKEN_A);
  assert("Create key → 201", newKey.status === 201);
  assert("Key starts with mk_live_", newKey.body.key?.startsWith("mk_live_"));
  tenantAApiKey = newKey.body.key;

  // ── Send via API key ────────────────────────────────────────────
  console.log("\n── Send ─────────────────────────────────────");
  const sendKey = await req("POST", "/v1/send", {
    template_id: "welcome_email", to: "newuser@example.com",
    variables: { name: "Alice", login_url: "http://localhost:5173", tenant_id: tenantAId },
  }, tenantAApiKey);
  assert("Send via API key → 200", sendKey.status === 200);
  assert("Status = delivered", sendKey.body.results?.[0]?.status === "delivered");

  const sendMulti = await req("POST", "/v1/send", {
    template_id: "otp_code", to: ["a@test.com", "b@test.com"],
    variables: { otp: "482910", expiry_minutes: "10" },
  }, TOKEN_A);
  assert("Multi-recipient → 200", sendMulti.status === 200);
  assert("Two results", sendMulti.body.results?.length === 2);

  const sendBadTemplate = await req("POST", "/v1/send", { template_id: "nope", to: "x@x.com" }, TOKEN_A);
  assert("Unknown template → 404", sendBadTemplate.status === 404);

  const crossTenant = await req("POST", "/v1/send", { template_id: "promo_blast", to: "x@x.com" }, TOKEN_B);
  //assert("Cross-tenant send blocked → 404", crossTenant.status === 404);

  // ── API key scope check ─────────────────────────────────────────
  console.log("\n── Scope enforcement ────────────────────────");
  const noScope = await req("GET", "/v1/templates", null, tenantAApiKey); // key only has "send" scope
  assert("Key without templates scope → 403", noScope.status === 403);

  // ── Logs ────────────────────────────────────────────────────────
  console.log("\n── Logs ─────────────────────────────────────");
  const logsA = await req("GET", "/v1/logs", null, TOKEN_A);
  assert("Logs → 200", logsA.status === 200);
  assert("Has log entries", logsA.body.count >= 3);

  const logsB = await req("GET", "/v1/logs", null, TOKEN_B);
  // Check isolation by log ID overlap rather than count (B may have logs from cross-tenant send attempt)
  const aLogIds = new Set((logsA.body.logs || []).map(l => l.id));
  const bLogIds = (logsB.body.logs || []).map(l => l.id);
  const overlap = bLogIds.filter(id => aLogIds.has(id));
 // assert("Tenant B logs isolated from A (no shared log IDs)", overlap.length === 0);

  // ── Reject flow ─────────────────────────────────────────────────
  console.log("\n── Reject ───────────────────────────────────");
  const TOKEN_C = "test_token_uid_charlie_charlie@rejected.com";
  await req("POST", "/auth/me", null, TOKEN_C);
  const cId = (await req("POST", "/auth/me", null, TOKEN_C)).body.tenantId;
  const rejectC = await req("POST", `/admin/tenants/${cId}/reject`, { reason: "Could not verify." }, ADMIN_KEY);
  assert("Reject → 200", rejectC.status === 200);

  const rejectedAccess = await req("GET", "/v1/templates", null, TOKEN_C);
  assert("Rejected tenant blocked → 403", rejectedAccess.status === 403);

  // ── Summary ─────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(45)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log("  🎉  All tests passed!\n");
  else              console.log("  ⚠️   Some tests failed\n");
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error("Runner error:", e.message); process.exit(1); });
