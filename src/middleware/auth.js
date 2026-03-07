// middleware/auth.js — dual-mode auth: JWT (dashboard) + API key (programmatic)

const jwt = require("jsonwebtoken");
const store = require("../store");

/**
 * requireAuth(scope?)
 *
 * Accepts two token types in Authorization: Bearer <token>
 *
 *   1. JWT (issued by /auth/login or /auth/register)
 *      → identifies tenant via tenantId in payload
 *      → always grants full access (dashboard use)
 *
 *   2. API Key (mk_live_...)
 *      → looks up key in store, checks tenantId + scope
 *      → used for programmatic API access
 *
 * In both cases, req.tenantId and req.authType are set for downstream handlers.
 */
function requireAuth(scope) {
  return (req, res, next) => {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization header. Use: Bearer <token>" });
    }

    // ── Try JWT first ─────────────────────────────────────────────────────────
    if (!token.startsWith("mk_")) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: "mailforge" });
        const tenant = store.getTenant(payload.tenantId);
        if (!tenant) return res.status(401).json({ error: "Tenant not found." });

        req.tenantId = payload.tenantId;
        req.authType = "jwt";
        req.jwtPayload = payload;
        return next();
      } catch (err) {
        if (err.name === "TokenExpiredError")
          return res.status(401).json({ error: "Access token expired. Use /auth/refresh to get a new one." });
        return res.status(401).json({ error: "Invalid token." });
      }
    }

    // ── Try API key ───────────────────────────────────────────────────────────
    const keyRecord = store.getKey(token);

    if (!keyRecord)
      return res.status(401).json({ error: "Invalid API key." });

    if (!keyRecord.active)
      return res.status(401).json({ error: "API key has been revoked." });

    if (scope && !keyRecord.scopes.includes(scope)) {
      return res.status(403).json({
        error: `This API key does not have the '${scope}' scope.`,
        key_scopes: keyRecord.scopes,
      });
    }

    store.touchKey(token);
    req.tenantId = keyRecord.tenantId;
    req.authType = "apikey";
    req.apiKey = keyRecord;
    return next();
  };
}

module.exports = { requireAuth };
