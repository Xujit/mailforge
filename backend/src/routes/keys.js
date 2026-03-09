// src/routes/keys.js

const express = require("express");
const router  = express.Router();
const { v4: uuidv4 } = require("uuid");
const { ApiKey } = require("../models");

const VALID_SCOPES = ["send", "templates", "keys"];

function redact(k) {
  const obj = k.toJSON ? k.toJSON() : k;
  return { ...obj, key: obj.key.slice(0, 12) + "••••••••••••" };
}

// GET /v1/keys
router.get("/", async (req, res) => {
  const keys = await ApiKey.findAll({
    where: { tenantId: req.tenantId },
    order: [["createdAt", "DESC"]],
  });
  res.json({ count: keys.length, keys: keys.map(redact) });
});

// POST /v1/keys
router.post("/", async (req, res) => {
  const { label, scopes } = req.body;
  if (!label) return res.status(400).json({ error: "'label' is required." });

  const scopeList = Array.isArray(scopes) ? scopes : ["send"];
  const invalid = scopeList.filter(s => !VALID_SCOPES.includes(s));
  if (invalid.length)
    return res.status(400).json({ error: `Invalid scopes: ${invalid.join(", ")}. Valid: ${VALID_SCOPES.join(", ")}` });

  const key = await ApiKey.create({
    key:      "mk_live_" + uuidv4().replace(/-/g, "").slice(0, 24),
    tenantId: req.tenantId,
    label,
    scopes:   scopeList,
    active:   true,
  });

  // Return the full key ONCE — not shown again after this response
  res.status(201).json({
    ...key.toJSON(),
    _note: "Save this key — it will not be shown again.",
  });
});

// DELETE /v1/keys/:key
router.delete("/:key", async (req, res) => {
  const key = await ApiKey.findOne({
    where: { key: req.params.key, tenantId: req.tenantId },
  });
  if (!key) return res.status(404).json({ error: "Key not found or does not belong to your account." });

  await key.update({ active: false });
  res.json({ revoked: true, key: redact(key) });
});

module.exports = router;
