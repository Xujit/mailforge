// routes/auth.js — register, login, refresh, logout (with approval gate)

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const store = require("../store");

const ACCESS_TTL  = "15m";
const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const attempt = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(attempt, "hex"));
}

function signAccessToken(tenant) {
  return jwt.sign(
    { tenantId: tenant.tenantId, email: tenant.email, name: tenant.name },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL, issuer: "mailforge" }
  );
}

function issueRefreshToken(tenantId) {
  const token = uuidv4() + uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TTL).toISOString();
  store.saveRefreshToken(token, tenantId, expiresAt);
  return { token, expiresAt };
}

// POST /auth/register — creates a PENDING tenant (awaiting admin approval)
router.post("/register", (req, res) => {
  const { email, password, name, company } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "'email' and 'password' are required." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email address." });
  if (store.getTenantByEmail(email))
    return res.status(409).json({ error: "An account with this email already exists." });

  const tenant = store.createTenant({ email, passwordHash: hashPassword(password), name, company });

  // Don't issue tokens — account is pending
  return res.status(201).json({
    status: "pending",
    message: "Your account request has been submitted. You'll receive an email once approved.",
    tenantId: tenant.tenantId,
  });
});

// POST /auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "'email' and 'password' are required." });

  const tenant = store.getTenantByEmail(email);
  const dummy  = "0000000000000000:" + "0".repeat(128);
  let ok = false;
  try { ok = verifyPassword(password, tenant?.passwordHash || dummy); } catch (_) {}

  if (!tenant || !ok)
    return res.status(401).json({ error: "Invalid email or password." });

  // Gate on approval status
  if (tenant.status === "pending")
    return res.status(403).json({ error: "Your account is pending admin approval.", status: "pending" });
  if (tenant.status === "rejected")
    return res.status(403).json({
      error: "Your account request was not approved.",
      reason: tenant.rejectionReason || null,
      status: "rejected",
    });

  const accessToken = signAccessToken(tenant);
  const refresh     = issueRefreshToken(tenant.tenantId);

  return res.json({
    tenant: { tenantId: tenant.tenantId, email: tenant.email, name: tenant.name },
    access_token: accessToken,
    refresh_token: refresh.token,
    refresh_expires_at: refresh.expiresAt,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
  });
});

// POST /auth/refresh
router.post("/refresh", (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: "'refresh_token' is required." });

  const record = store.getRefreshToken(refresh_token);
  if (!record) return res.status(401).json({ error: "Invalid or expired refresh token." });
  if (new Date(record.expiresAt) < new Date()) {
    store.deleteRefreshToken(refresh_token);
    return res.status(401).json({ error: "Refresh token expired. Please log in again." });
  }

  const tenant = store.getTenant(record.tenantId);
  if (!tenant) return res.status(401).json({ error: "Tenant not found." });

  store.deleteRefreshToken(refresh_token);
  const accessToken = signAccessToken(tenant);
  const refresh     = issueRefreshToken(tenant.tenantId);

  return res.json({
    access_token: accessToken,
    refresh_token: refresh.token,
    refresh_expires_at: refresh.expiresAt,
    token_type: "Bearer",
    expires_in: ACCESS_TTL,
  });
});

// POST /auth/logout
router.post("/logout", (req, res) => {
  const { refresh_token } = req.body;
  if (refresh_token) store.deleteRefreshToken(refresh_token);
  return res.json({ message: "Logged out." });
});

module.exports = router;
