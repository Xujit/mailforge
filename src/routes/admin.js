// routes/admin.js — admin-only tenant management

const express = require("express");
const router  = express.Router();
const store   = require("../store");
const { renderTemplate, sendEmail } = require("../services/mailer");

// Simple admin key middleware — separate from tenant JWT
function requireAdmin(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const adminKey = process.env.ADMIN_KEY || "admin_changeme";

  if (!token || token !== adminKey)
    return res.status(401).json({ error: "Invalid or missing admin key." });
  next();
}

// GET /admin/tenants?status=pending|active|rejected
router.get("/tenants", requireAdmin, (req, res) => {
  const { status } = req.query;
  const list = store.listTenants(status ? { status } : {});
  res.json({ count: list.length, tenants: list.map(safe) });
});

// GET /admin/tenants/:tenantId
router.get("/tenants/:tenantId", requireAdmin, (req, res) => {
  const t = store.getTenant(req.params.tenantId);
  if (!t) return res.status(404).json({ error: "Tenant not found." });
  res.json(safe(t));
});

// POST /admin/tenants/:tenantId/approve
router.post("/tenants/:tenantId/approve", requireAdmin, async (req, res) => {
  const t = store.approveTenant(req.params.tenantId);
  if (!t) return res.status(404).json({ error: "Tenant not found." });

  // Send approval email via MailForge itself
  const loginUrl = process.env.APP_URL
    ? `${process.env.APP_URL}/login`
    : "http://localhost:5173/login";

  try {
    const tmplKey   = `${t.tenantId}::welcome_email`;
    // Use the system-level welcome template
    const { renderTemplate: render } = require("../services/mailer");
    const subject = render("Welcome to MailForge, {{name}}!", { name: t.name });
    const html    = render(
      `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="color:#6d28d9">Welcome aboard, {{name}}! 🎉</h1>
  <p>Your <strong>MailForge</strong> account has been approved. You can now log in and start sending.</p>
  <a href="{{login_url}}" style="display:inline-block;margin-top:16px;background:#6d28d9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard →</a>
  <p style="margin-top:24px;color:#64748b;font-size:13px">Tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
      { name: t.name, login_url: loginUrl, tenant_id: t.tenantId }
    );
    const text = render(
      `Hi {{name}},\n\nYour MailForge account has been approved!\nLogin at: {{login_url}}\nTenant ID: {{tenant_id}}`,
      { name: t.name, login_url: loginUrl, tenant_id: t.tenantId }
    );

    const sent = await sendEmail({ to: t.email, subject, html, text });

    store.addLog({
      tenantId: "system",
      templateId: "welcome_email",
      to: t.email,
      subject,
      status: "delivered",
      messageId: sent.messageId,
      previewUrl: sent.previewUrl,
      apiKeyLabel: "admin",
      variables: {},
    });

    return res.json({
      approved: true,
      tenant: safe(t),
      email_sent: true,
      preview_url: sent.previewUrl || null,
    });
  } catch (err) {
    // Approval succeeded even if email fails
    return res.json({
      approved: true,
      tenant: safe(t),
      email_sent: false,
      email_error: err.message,
    });
  }
});

// POST /admin/tenants/:tenantId/reject
router.post("/tenants/:tenantId/reject", requireAdmin, (req, res) => {
  const { reason } = req.body;
  const t = store.rejectTenant(req.params.tenantId, reason);
  if (!t) return res.status(404).json({ error: "Tenant not found." });
  res.json({ rejected: true, tenant: safe(t) });
});

// GET /admin/stats
router.get("/stats", requireAdmin, (req, res) => {
  const all      = store.listTenants();
  const pending  = all.filter(t => t.status === "pending").length;
  const active   = all.filter(t => t.status === "active").length;
  const rejected = all.filter(t => t.status === "rejected").length;
  res.json({ total: all.length, pending, active, rejected });
});

// Strip passwordHash from responses
function safe(t) {
  const { passwordHash, ...rest } = t;
  return rest;
}

module.exports = router;
