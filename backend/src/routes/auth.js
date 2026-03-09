// src/routes/auth.js

const express = require("express");
const router  = express.Router();
const { verifyIdToken } = require("../firebase");
const { Tenant } = require("../models");
const { v4: uuidv4 } = require("uuid");

// ── POST /auth/me ─────────────────────────────────────────────────────────────
router.post("/me", async (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing Authorization header." });

  let decoded;
  try { decoded = await verifyIdToken(token); }
  catch (err) { return res.status(401).json({ error: "Invalid Firebase token.", detail: err.message }); }

  let tenant = await Tenant.findOne({ where: { firebaseUid: decoded.uid } });
  let isNew  = false;

  if (!tenant) {
    tenant = await Tenant.create({
      id:          "t_" + uuidv4().replace(/-/g, "").slice(0, 16),
      firebaseUid: decoded.uid,
      email:       decoded.email || "",
      name:        decoded.name || decoded.email || "Unknown",
      photoUrl:    decoded.picture || null,
      status:      "pending",
    });
    isNew = true;
  }

  return res.json({
    tenantId:    tenant.id,
    email:       tenant.email,
    name:        tenant.name,
    company:     tenant.company,
    phone:       tenant.phone,
    photoUrl:    tenant.photoUrl,
    status:      tenant.status,
    // tells the frontend whether the profile is complete
    profileComplete: !!(tenant.name && tenant.company && tenant.phone),
    isNew,
    ...(tenant.status === "rejected" ? { rejectionReason: tenant.rejectionReason } : {}),
  });
});

// ── POST /auth/register-profile ───────────────────────────────────────────────
// Accepts: name (required), company (required), phone (required)
router.post("/register-profile", async (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ error: "Missing Authorization header." });

  let decoded;
  try { decoded = await verifyIdToken(token); }
  catch (err) { return res.status(401).json({ error: "Invalid Firebase token." }); }

  const { name, company, phone } = req.body;

  if (!name)    return res.status(400).json({ error: "'name' is required." });
  if (!company) return res.status(400).json({ error: "'company' is required." });
  if (!phone)   return res.status(400).json({ error: "'phone' is required." });

  // Basic phone format validation — must contain only digits, spaces, +, -, ()
  if (!/^[+\d\s\-().]{7,20}$/.test(phone.trim()))
    return res.status(400).json({ error: "Invalid phone number format." });

  const tenant = await Tenant.findOne({ where: { firebaseUid: decoded.uid } });
  if (!tenant) return res.status(404).json({ error: "Tenant not found. Call /auth/me first." });

  await tenant.update({ name, company, phone: phone.trim() });

  return res.json({
    status:   tenant.status,
    message:  "Profile saved. Your account is pending admin approval.",
    tenantId: tenant.id,
    name:     tenant.name,
    company:  tenant.company,
    phone:    tenant.phone,
  });
});

module.exports = router;
