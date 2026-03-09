// src/services/subscriptionJob.js
//
// Runs once on server start, then every 24 hours.
// Does two things:
//   1. Flips subscriptionStatus → "expired" for lapsed tenants
//   2. Sends a warning email 3 days before expiry (once per cycle)

const { Op }   = require("sequelize");
const { Tenant } = require("../models");
const { renderTemplate, sendEmail } = require("./mailer");

const WARNING_DAYS_BEFORE = 3;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function runSubscriptionJob() {
  console.log(`[SubscriptionJob] Running at ${new Date().toISOString()}`);
  const now           = new Date();
  const warningCutoff = new Date(now.getTime() + WARNING_DAYS_BEFORE * 24 * 60 * 60 * 1000);

  // ── 1. Expire lapsed trial tenants ─────────────────────────────────────────
  const expiredTrials = await Tenant.update(
    { subscriptionStatus: "expired" },
    {
      where: {
        subscriptionStatus: "trial",
        trialEndsAt: { [Op.lt]: now },
      },
    }
  );

  // ── 2. Expire lapsed paid subscriptions ────────────────────────────────────
  const expiredPaid = await Tenant.update(
    { subscriptionStatus: "expired" },
    {
      where: {
        subscriptionStatus: "active",
        planExpiresAt: { [Op.lt]: now },
      },
    }
  );

  const totalExpired = expiredTrials[0] + expiredPaid[0];
  if (totalExpired > 0) console.log(`[SubscriptionJob] Expired ${totalExpired} tenant(s).`);

  // ── 3. Send warning emails for trial tenants expiring within 3 days ────────
  const trialWarnCandidates = await Tenant.findAll({
    where: {
      subscriptionStatus: "trial",
      trialEndsAt: { [Op.between]: [now, warningCutoff] },
      // Only send once — null means never sent, or reset at start of new cycle
      warningEmailSentAt: null,
    },
  });

  // ── 4. Send warning emails for paid tenants expiring within 3 days ─────────
  const paidWarnCandidates = await Tenant.findAll({
    where: {
      subscriptionStatus: "active",
      planExpiresAt: { [Op.between]: [now, warningCutoff] },
      warningEmailSentAt: null,
    },
  });

  const allWarnCandidates = [...trialWarnCandidates, ...paidWarnCandidates];

  for (const tenant of allWarnCandidates) {
    const isTrial   = tenant.subscriptionStatus === "trial";
    const expiresAt = isTrial ? tenant.trialEndsAt : tenant.planExpiresAt;
    const daysLeft  = Math.ceil((new Date(expiresAt) - now) / (1000 * 60 * 60 * 24));

    try {
      const subject = renderTemplate(
        isTrial
          ? "⚠️ Your MailForge trial ends in {{days}} day(s)"
          : "⚠️ Your MailForge subscription renews in {{days}} day(s)",
        { days: daysLeft }
      );

      const html = renderTemplate(
        `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h2 style="color:#f59e0b">⚠️ {{type}} Expiring Soon</h2>
  <p>Hi <strong>{{name}}</strong>,</p>
  <p>Your MailForge {{type_lower}} will expire in <strong>{{days}} day(s)</strong> on <strong>{{expiry_date}}</strong>.</p>
  {{#if is_trial}}
  <p>After your trial ends, API access will be blocked until you subscribe to a monthly or yearly plan.</p>
  {{else}}
  <p>After your subscription expires, API access will be blocked until renewed.</p>
  {{/if}}
  <p>Please contact your administrator to {{#if is_trial}}subscribe{{else}}renew{{/if}} before access is interrupted.</p>
  <p style="margin-top:24px;color:#64748b;font-size:12px">Tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
        {
          name:        tenant.name,
          type:        isTrial ? "Trial" : "Subscription",
          type_lower:  isTrial ? "trial" : "subscription",
          days:        daysLeft,
          expiry_date: new Date(expiresAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }),
          is_trial:    isTrial,
          tenant_id:   tenant.id,
        }
      );

      const text = `Hi ${tenant.name},\n\nYour MailForge ${isTrial ? "trial" : "subscription"} expires in ${daysLeft} day(s) on ${new Date(expiresAt).toDateString()}.\n\nPlease contact your administrator to ${isTrial ? "subscribe" : "renew"}.`;

      await sendEmail({ to: tenant.email, subject, html, text });
      await tenant.update({ warningEmailSentAt: now });

      console.log(`[SubscriptionJob] Warning email sent → ${tenant.email} (${daysLeft}d left)`);
    } catch (err) {
      console.error(`[SubscriptionJob] Failed to send warning to ${tenant.email}:`, err.message);
    }
  }

  console.log(`[SubscriptionJob] Done. Warned: ${allWarnCandidates.length}, Expired: ${totalExpired}`);
}

function startSubscriptionJob() {
  // Run immediately on boot, then every 24h
  runSubscriptionJob().catch(err => console.error("[SubscriptionJob] Error:", err.message));
  setInterval(() => {
    runSubscriptionJob().catch(err => console.error("[SubscriptionJob] Error:", err.message));
  }, INTERVAL_MS);
}

module.exports = { startSubscriptionJob, runSubscriptionJob };
