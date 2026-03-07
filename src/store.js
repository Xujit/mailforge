// store.js — tenant-scoped in-memory data store v3 (with approval flow)
const { v4: uuidv4 } = require("uuid");

// ── Tenants ───────────────────────────────────────────────────────────────────
// status: "pending" | "active" | "rejected"
const tenants = new Map();
const tenantsByEmail = new Map();

function createTenant({ email, passwordHash, name, company }) {
  const tenantId = "t_" + uuidv4().replace(/-/g, "").slice(0, 16);
  const record = {
    tenantId,
    email: email.toLowerCase().trim(),
    passwordHash,
    name: name || email,
    company: company || "",
    status: "pending",   // ← must be approved by admin
    createdAt: new Date().toISOString(),
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
  };
  tenants.set(tenantId, record);
  tenantsByEmail.set(record.email, record);
  return record;
}

function getTenantByEmail(email) {
  return tenantsByEmail.get(email.toLowerCase().trim()) || null;
}

function getTenant(tenantId) { return tenants.get(tenantId) || null; }

function listTenants({ status } = {}) {
  const all = [...tenants.values()];
  return status ? all.filter(t => t.status === status) : all;
}

function approveTenant(tenantId) {
  const t = tenants.get(tenantId);
  if (!t) return null;
  t.status = "active";
  t.approvedAt = new Date().toISOString();
  _seedTemplatesForTenant(tenantId);
  // Create a default API key for new active tenant
  createKey({ tenantId, label: "Default", scopes: ["send", "templates", "keys"] });
  return t;
}

function rejectTenant(tenantId, reason = "") {
  const t = tenants.get(tenantId);
  if (!t) return null;
  t.status = "rejected";
  t.rejectedAt = new Date().toISOString();
  t.rejectionReason = reason;
  return t;
}

// ── Refresh Tokens ────────────────────────────────────────────────────────────
const refreshTokens = new Map();
function saveRefreshToken(token, tenantId, expiresAt) { refreshTokens.set(token, { tenantId, expiresAt }); }
function getRefreshToken(token) { return refreshTokens.get(token) || null; }
function deleteRefreshToken(token) { refreshTokens.delete(token); }

// ── API Keys (tenant-scoped) ──────────────────────────────────────────────────
const apiKeys = new Map();

function createKey({ tenantId, label, scopes }) {
  const key = "mk_live_" + uuidv4().replace(/-/g, "").slice(0, 24);
  const record = { key, tenantId, label, scopes, active: true, createdAt: new Date().toISOString(), lastUsed: null };
  apiKeys.set(key, record);
  return record;
}

function getKey(key) { return apiKeys.get(key) || null; }
function listKeys(tenantId) { return [...apiKeys.values()].filter(k => k.tenantId === tenantId); }
function revokeKey(key, tenantId) {
  const r = apiKeys.get(key);
  if (!r || r.tenantId !== tenantId) return null;
  r.active = false; return r;
}
function touchKey(key) { const r = apiKeys.get(key); if (r) r.lastUsed = new Date().toISOString(); }

// ── Templates (tenant-scoped) ─────────────────────────────────────────────────
const templates = new Map();

const DEFAULT_TEMPLATES = [
  {
    id: "welcome_email",
    subject: "Welcome to MailForge, {{name}}!",
    htmlBody: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="color:#6d28d9">Welcome aboard, {{name}}! 🎉</h1>
  <p>Your <strong>MailForge</strong> account has been approved. You can now log in and start sending.</p>
  <a href="{{login_url}}" style="display:inline-block;margin-top:16px;background:#6d28d9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard →</a>
  <p style="margin-top:24px;color:#64748b;font-size:13px">Your tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
    textBody: `Hi {{name}},\n\nYour MailForge account has been approved!\nLogin at: {{login_url}}\nTenant ID: {{tenant_id}}`,
    variables: ["name", "login_url", "tenant_id"],
  },
  {
    id: "password_reset",
    subject: "Reset your password",
    htmlBody: `<h2>Password Reset</h2><p>Expires in <strong>{{expiry_minutes}} minutes</strong>.</p><p><a href="{{reset_link}}">Reset Password</a></p>`,
    textBody: `Reset (expires {{expiry_minutes}} min): {{reset_link}}`,
    variables: ["reset_link", "expiry_minutes"],
  },
  {
    id: "otp_code",
    subject: "Your verification code: {{otp}}",
    htmlBody: `<h2>Your Code</h2><p style="font-size:32px;letter-spacing:8px;font-weight:bold;">{{otp}}</p><p>Expires in {{expiry_minutes}} minutes.</p>`,
    textBody: `Your code: {{otp}} — expires in {{expiry_minutes}} minutes.`,
    variables: ["otp", "expiry_minutes"],
  },
];

function _seedTemplatesForTenant(tenantId) {
  DEFAULT_TEMPLATES.forEach(t => {
    templates.set(`${tenantId}::${t.id}`, {
      ...t, tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sends: 0,
    });
  });
}

function getTemplate(tenantId, id) { return templates.get(`${tenantId}::${id}`) || null; }
function listTemplates(tenantId) { return [...templates.values()].filter(t => t.tenantId === tenantId); }

function upsertTemplate({ tenantId, id, subject, htmlBody, textBody, variables }) {
  const key = `${tenantId}::${id}`;
  const existing = templates.get(key);
  const record = {
    id, tenantId, subject, htmlBody, textBody: textBody || "",
    variables: variables || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sends: existing?.sends || 0,
  };
  templates.set(key, record);
  return record;
}

function deleteTemplate(tenantId, id) {
  const key = `${tenantId}::${id}`;
  if (!templates.has(key)) return false;
  templates.delete(key); return true;
}

function incrementSends(tenantId, id) {
  const t = templates.get(`${tenantId}::${id}`);
  if (t) t.sends++;
}

// ── Logs (tenant-scoped) ──────────────────────────────────────────────────────
const logsByTenant = new Map();

function addLog(entry) {
  const record = { ...entry, id: "msg_" + uuidv4().replace(/-/g, "").slice(0, 10), createdAt: new Date().toISOString() };
  if (!logsByTenant.has(entry.tenantId)) logsByTenant.set(entry.tenantId, []);
  const list = logsByTenant.get(entry.tenantId);
  list.unshift(record);
  if (list.length > 1000) list.pop();
  return record;
}

function listLogs(tenantId, { limit = 50, templateId, status } = {}) {
  let result = logsByTenant.get(tenantId) || [];
  if (templateId) result = result.filter(l => l.templateId === templateId);
  if (status)     result = result.filter(l => l.status === status);
  return result.slice(0, limit);
}

function getLog(tenantId, id) {
  return (logsByTenant.get(tenantId) || []).find(l => l.id === id) || null;
}

module.exports = {
  createTenant, getTenant, getTenantByEmail, listTenants, approveTenant, rejectTenant,
  saveRefreshToken, getRefreshToken, deleteRefreshToken,
  createKey, getKey, listKeys, revokeKey, touchKey,
  getTemplate, listTemplates, upsertTemplate, deleteTemplate, incrementSends,
  addLog, listLogs, getLog,
};
