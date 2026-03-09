// src/middleware/auth.js
//
// Dual-mode authentication:
//   1. Firebase ID token  (Authorization: Bearer <firebase-id-token>)
//      → verified by Firebase Admin SDK
//      → tenant looked up / auto-created by firebaseUid
//      → status must be "active" to proceed
//
//   2. API key  (Authorization: Bearer mk_live_...)
//      → looked up in SQLite ApiKey table
//      → scope-checked if required

const { verifyIdToken } = require("../firebase");
const { Tenant, ApiKey } = require("../models");
const { v4: uuidv4 }     = require("uuid");

function requireAuth(scope) {
  return async (req, res, next) => {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token)
      return res.status(401).json({ error: "Missing Authorization header. Use: Bearer <token>" });

    // ── API Key path ──────────────────────────────────────────────────────────
    if (token.startsWith("mk_")) {
      try {
        const keyRecord = await ApiKey.findByPk(token);
        if (!keyRecord)        return res.status(401).json({ error: "Invalid API key." });
        if (!keyRecord.active) return res.status(401).json({ error: "API key has been revoked." });

        if (scope && !keyRecord.scopes.includes(scope)) {
          return res.status(403).json({
            error: `This API key does not have the '${scope}' scope.`,
            key_scopes: keyRecord.scopes,
          });
        }

        const tenant = await Tenant.findByPk(keyRecord.tenantId);
        if (!tenant || tenant.status !== "active")
          return res.status(403).json({ error: "Tenant account is not active." });

        keyRecord.update({ lastUsed: new Date() }).catch(() => {});

        req.tenantId = keyRecord.tenantId;
        req.authType = "apikey";
        req.apiKey   = keyRecord;
        return next();
      } catch (err) {
        return res.status(500).json({ error: "Auth error.", detail: err.message });
      }
    }

    // ── Firebase ID token path ────────────────────────────────────────────────
    try {
      const decoded = await verifyIdToken(token);

      // Find or create tenant record linked to this Firebase UID
      let tenant = await Tenant.findOne({ where: { firebaseUid: decoded.uid } });

      if (!tenant) {
        // First login — create a pending record awaiting admin approval
        tenant = await Tenant.create({
          id:          "t_" + uuidv4().replace(/-/g, "").slice(0, 16),
          firebaseUid: decoded.uid,
          email:       decoded.email || "",
          name:        decoded.name || decoded.email || "Unknown",
          photoUrl:    decoded.picture || null,
          status:      "pending",
        });
      } else {
        // Sync name/photo with latest Firebase profile
        const updates = {};
        if (decoded.name    && decoded.name    !== tenant.name)     updates.name     = decoded.name;
        if (decoded.picture && decoded.picture !== tenant.photoUrl) updates.photoUrl = decoded.picture;
        if (Object.keys(updates).length) tenant.update(updates).catch(() => {});
      }

      if (tenant.status === "pending")
        return res.status(403).json({ error: "Your account is pending admin approval.", status: "pending" });
      if (tenant.status === "rejected")
        return res.status(403).json({
          error: "Your account request was not approved.",
          reason: tenant.rejectionReason || null,
          status: "rejected",
        });

      req.tenantId    = tenant.id;
      req.authType    = "firebase";
      req.firebaseUid = decoded.uid;
      req.tenant      = tenant;
      return next();
    } catch (err) {
      if (err.code === "auth/id-token-expired")
        return res.status(401).json({ error: "Firebase ID token expired. Re-authenticate on the client." });
      if (err.code?.startsWith("auth/"))
        return res.status(401).json({ error: "Invalid Firebase token.", detail: err.message });
      return res.status(500).json({ error: "Auth error.", detail: err.message });
    }
  };
}

module.exports = { requireAuth };
