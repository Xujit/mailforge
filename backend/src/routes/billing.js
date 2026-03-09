// src/routes/billing.js
// Tenant-facing billing status — called by the frontend dashboard

const express = require("express");
const router  = express.Router();
const { requireAuth }         = require("../middleware/auth");
const { Tenant } = require("../models");

// GET /billing/status — returns current tenant's subscription info
router.get("/status", requireAuth(), async (req, res) => {
  const tenant = await Tenant.findByPk(req.tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found." });

  const now          = new Date();
  const trialDaysLeft = tenant.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt) - now) / 86400000))
    : null;
  const planDaysLeft  = tenant.planExpiresAt
    ? Math.max(0, Math.ceil((new Date(tenant.planExpiresAt) - now) / 86400000))
    : null;

  res.json({
    subscriptionStatus: tenant.subscriptionStatus,
    planType:           tenant.planType,
    trialEndsAt:        tenant.trialEndsAt,
    planExpiresAt:      tenant.planExpiresAt,
    trialDaysLeft,
    planDaysLeft,
  });
});

module.exports = router;
