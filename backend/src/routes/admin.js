// src/routes/admin.js

const express  = require("express");
const router   = express.Router();
const { Tenant, ApiKey } = require("../models");
const { seedDefaultTemplates } = require("../seeders/defaultTemplates");
const { renderTemplate, sendEmail } = require("../services/mailer");

function requireAdmin(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token || token !== (process.env.ADMIN_KEY || "admin_changeme"))
    return res.status(401).json({ error: "Invalid or missing admin key." });
  next();
}

function safe(t) {
  const obj = t.toJSON ? t.toJSON() : { ...t };
  delete obj.passwordHash;
  return obj;
}

function planLabel(t) {
  if (t.subscriptionStatus === "trial") {
    const daysLeft = t.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(t.trialEndsAt) - Date.now()) / 86400000))
      : null;
    return { label: `Trial (${daysLeft ?? "?"}d left)`, daysLeft };
  }
  if (t.subscriptionStatus === "active") {
    return { label: `${t.planType} — expires ${new Date(t.planExpiresAt).toLocaleDateString("en-GB")}` };
  }
  return { label: t.subscriptionStatus };
}

// ── GET /admin/tenants?status= ────────────────────────────────────────────────
router.get("/tenants", requireAdmin, async (req, res) => {
  const where = req.query.status ? { status: req.query.status } : {};
  const tenants = await Tenant.findAll({ where, order: [["createdAt", "DESC"]] });
  res.json({
    count: tenants.length,
    tenants: tenants.map(t => ({ ...safe(t), _plan: planLabel(t) })),
  });
});

// ── GET /admin/tenants/:id ────────────────────────────────────────────────────
router.get("/tenants/:id", requireAdmin, async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });
  res.json({ ...safe(tenant), _plan: planLabel(tenant) });
});

// ── POST /admin/tenants/:id/approve ──────────────────────────────────────────
router.post("/tenants/:id/approve", requireAdmin, async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });

  const now         = new Date();
  const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // +7 days

  await tenant.update({
    status:             "active",
    approvedAt:         now,
    subscriptionStatus: "trial",
    trialEndsAt,
  });

  await seedDefaultTemplates(tenant.id);
  await ApiKey.create({
    key:      "mk_live_" + require("uuid").v4().replace(/-/g, "").slice(0, 24),
    tenantId: tenant.id,
    label:    "Default",
    scopes:   ["send", "templates", "keys"],
    active:   true,
  });

  // Send approval + trial info email
  const loginUrl = `${process.env.APP_URL || "http://localhost:5173"}/login`;
  let emailSent = false, previewUrl = null;

  try {
    const html = renderTemplate(
      `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="color:#6d28d9">Welcome aboard, {{name}}! 🎉</h1>
  <p>Your <strong>MailForge</strong> account has been approved.</p>
  <div style="background:#1e1b4b;border:1px solid #4338ca33;border-radius:8px;padding:16px;margin:20px 0">
    <p style="color:#a78bfa;font-weight:600;margin:0 0 6px">⏱ 7-Day Free Trial Active</p>
    <p style="color:#94a3b8;font-size:13px;margin:0">Your trial ends on <strong style="color:#e2e8f0">{{trial_end}}</strong>. After that, a monthly or yearly subscription is required to continue using the API.</p>
  </div>
  <a href="{{login_url}}" style="display:inline-block;margin-top:8px;background:#6d28d9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard →</a>
  <p style="margin-top:24px;color:#64748b;font-size:12px">Tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
      {
        name:       tenant.name,
        login_url:  loginUrl,
        tenant_id:  tenant.id,
        trial_end:  trialEndsAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
      }
    );
    const text = `Hi ${tenant.name},\n\nYour MailForge account is approved! You have a 7-day free trial until ${trialEndsAt.toDateString()}.\n\nLogin: ${loginUrl}`;
    const sent = await sendEmail({ to: tenant.email, subject: `Welcome to MailForge, ${tenant.name}! Your 7-day trial starts now`, html, text });
    emailSent  = true;
    previewUrl = sent.previewUrl || null;
  } catch (err) {
    console.error("Approval email failed:", err.message);
  }

  return res.json({
    approved: true,
    tenant: safe(tenant),
    trial_ends_at: trialEndsAt.toISOString(),
    email_sent: emailSent,
    preview_url: previewUrl,
  });
});

// ── POST /admin/tenants/:id/reject ────────────────────────────────────────────
router.post("/tenants/:id/reject", requireAdmin, async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });
  await tenant.update({ status: "rejected", rejectedAt: new Date(), rejectionReason: req.body.reason || null });
  res.json({ rejected: true, tenant: safe(tenant) });
});

// ── POST /admin/tenants/:id/subscribe ─────────────────────────────────────────
// Admin manually marks a tenant as paid.
// Body: { plan: "monthly" | "yearly" }
router.post("/tenants/:id/subscribe", requireAdmin, async (req, res) => {
  const { plan } = req.body;
  if (!["monthly", "yearly"].includes(plan))
    return res.status(400).json({ error: "'plan' must be 'monthly' or 'yearly'." });

  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });
  if (tenant.status !== "active")
    return res.status(400).json({ error: "Tenant must be approved first." });

  const now          = new Date();
  const planExpiresAt = new Date(
    plan === "yearly"
      ? now.getTime() + 365 * 24 * 60 * 60 * 1000
      : now.getTime() +  30 * 24 * 60 * 60 * 1000
  );

  await tenant.update({
    subscriptionStatus: "active",
    planType:           plan,
    planExpiresAt,
    warningEmailSentAt: null, // reset so warning sends again near new expiry
  });

  // Send confirmation email
  let emailSent = false, previewUrl = null;
  try {
    const html = renderTemplate(
      `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h2 style="color:#22c55e">✅ Subscription Activated</h2>
  <p>Hi <strong>{{name}}</strong>, your <strong>{{plan}}</strong> subscription is now active.</p>
  <div style="background:#14532d33;border:1px solid #22c55e33;border-radius:8px;padding:16px;margin:20px 0">
    <p style="color:#94a3b8;margin:0">Plan: <strong style="color:#e2e8f0">{{plan_cap}}</strong></p>
    <p style="color:#94a3b8;margin:6px 0 0">Renews / expires: <strong style="color:#e2e8f0">{{expiry}}</strong></p>
  </div>
  <p style="color:#64748b;font-size:12px;margin-top:24px">Tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
      {
        name:      tenant.name,
        plan,
        plan_cap:  plan.charAt(0).toUpperCase() + plan.slice(1),
        expiry:    planExpiresAt.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
        tenant_id: tenant.id,
      }
    );
    const text = `Hi ${tenant.name},\n\nYour ${plan} MailForge subscription is active until ${planExpiresAt.toDateString()}.`;
    const sent = await sendEmail({ to: tenant.email, subject: `✅ Your MailForge ${plan} subscription is active`, html, text });
    emailSent  = true;
    previewUrl = sent.previewUrl || null;
  } catch (err) {
    console.error("Subscription email failed:", err.message);
  }

  return res.json({
    subscribed: true,
    plan,
    plan_expires_at: planExpiresAt.toISOString(),
    tenant: safe(tenant),
    email_sent: emailSent,
    preview_url: previewUrl,
  });
});

// ── POST /admin/tenants/:id/cancel ────────────────────────────────────────────
router.post("/tenants/:id/cancel", requireAdmin, async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });
  await tenant.update({ subscriptionStatus: "cancelled", planType: null, planExpiresAt: null });
  res.json({ cancelled: true, tenant: safe(tenant) });
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (req, res) => {
  const [total, pending, active, rejected] = await Promise.all([
    Tenant.count(),
    Tenant.count({ where: { status: "pending" } }),
    Tenant.count({ where: { status: "active" } }),
    Tenant.count({ where: { status: "rejected" } }),
  ]);
  const [onTrial, subscribed, expired] = await Promise.all([
    Tenant.count({ where: { subscriptionStatus: "trial"   } }),
    Tenant.count({ where: { subscriptionStatus: "active"  } }),
    Tenant.count({ where: { subscriptionStatus: "expired" } }),
  ]);
  res.json({ total, pending, active, rejected, onTrial, subscribed, expired });
});

// ── GET /billing/status (tenant-facing, via auth middleware) ──────────────────
// Returns subscription status for the logged-in tenant (called from frontend)
router.get("/billing-status/:tenantId", requireAdmin, async (req, res) => {
  const tenant = await Tenant.findByPk(req.params.tenantId);
  if (!tenant) return res.status(404).json({ error: "Not found." });
  const now = new Date();
  res.json({
    subscriptionStatus: tenant.subscriptionStatus,
    planType:           tenant.planType,
    trialEndsAt:        tenant.trialEndsAt,
    planExpiresAt:      tenant.planExpiresAt,
    trialDaysLeft:      tenant.trialEndsAt ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - now) / 86400000)) : null,
  });
});

module.exports = router;
