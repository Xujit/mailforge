// src/middleware/subscription.js
//
// Must run AFTER requireAuth (needs req.tenantId + req.tenant).
// Checks subscriptionStatus and blocks expired tenants with a clear error.

const { Tenant } = require("../models");

async function requireSubscription(req, res, next) {
  // Load fresh tenant if not already attached by auth middleware
  const tenant = req.tenant || await Tenant.findByPk(req.tenantId);
  if (!tenant) return res.status(401).json({ error: "Tenant not found." });

  // Always re-evaluate expiry in real time
  // (catches cases where status wasn't flipped by the daily job yet)
  const now = new Date();

  if (tenant.subscriptionStatus === "trial") {
    if (tenant.trialEndsAt && now > new Date(tenant.trialEndsAt)) {
      // Trial has lapsed — flip status now rather than waiting for the daily job
      await tenant.update({ subscriptionStatus: "expired" });
      return res.status(402).json({
        error: "Your 7-day free trial has ended.",
        subscription_status: "expired",
        action_required: "Contact your administrator to subscribe.",
      });
    }

    // Still in trial — attach days remaining for informational headers
    const daysLeft = Math.ceil((new Date(tenant.trialEndsAt) - now) / (1000 * 60 * 60 * 24));
    res.setHeader("X-Trial-Days-Remaining", daysLeft);
    req.subscriptionMeta = { status: "trial", daysLeft, trialEndsAt: tenant.trialEndsAt };
    return next();
  }

  if (tenant.subscriptionStatus === "active") {
    if (tenant.planExpiresAt && now > new Date(tenant.planExpiresAt)) {
      await tenant.update({ subscriptionStatus: "expired" });
      return res.status(402).json({
        error: "Your subscription has expired.",
        subscription_status: "expired",
        action_required: "Contact your administrator to renew.",
      });
    }
    req.subscriptionMeta = { status: "active", planType: tenant.planType, planExpiresAt: tenant.planExpiresAt };
    return next();
  }

  if (tenant.subscriptionStatus === "expired") {
    return res.status(402).json({
      error: "Your subscription has expired. API access is blocked.",
      subscription_status: "expired",
      action_required: "Contact your administrator to renew.",
    });
  }

  if (tenant.subscriptionStatus === "cancelled") {
    return res.status(402).json({
      error: "Your subscription has been cancelled.",
      subscription_status: "cancelled",
    });
  }

  next();
}

module.exports = { requireSubscription };
