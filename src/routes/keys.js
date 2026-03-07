// routes/keys.js — tenant-scoped API key management

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const store = require("../store");

const VALID_SCOPES = ["send", "templates", "keys"];

function redact(k) {
  return { ...k, key: k.key.slice(0, 12) + "••••••••••••" };
}

router.get("/", requireAuth("keys"), (req, res) => {
  res.json({ count: 0, keys: store.listKeys(req.tenantId).map(redact) });
});

router.post("/", requireAuth("keys"), (req, res) => {
  const { label, scopes } = req.body;
  if (!label) return res.status(400).json({ error: "'label' is required." });

  const scopeList = Array.isArray(scopes) ? scopes : ["send"];
  const invalid = scopeList.filter(s => !VALID_SCOPES.includes(s));
  if (invalid.length) return res.status(400).json({ error: `Invalid scopes: ${invalid.join(", ")}` });

  const record = store.createKey({ tenantId: req.tenantId, label, scopes: scopeList });
  res.status(201).json({ ...record, _note: "Save this key — it will not be shown again." });
});

router.delete("/:key", requireAuth("keys"), (req, res) => {
  const record = store.revokeKey(req.params.key, req.tenantId);
  if (!record) return res.status(404).json({ error: "Key not found or does not belong to your account." });
  res.json({ revoked: true, key: redact(record) });
});

module.exports = router;
