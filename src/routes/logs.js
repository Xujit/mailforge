// routes/logs.js — tenant-scoped delivery logs

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const store = require("../store");

router.get("/", requireAuth("send"), (req, res) => {
  const { limit = 50, template_id, status } = req.query;
  const logs = store.listLogs(req.tenantId, {
    limit: Math.min(parseInt(limit) || 50, 500),
    templateId: template_id,
    status,
  });
  res.json({ count: logs.length, logs });
});

router.get("/:id", requireAuth("send"), (req, res) => {
  const log = store.getLog(req.tenantId, req.params.id);
  if (!log) return res.status(404).json({ error: `Log '${req.params.id}' not found.` });
  res.json(log);
});

module.exports = router;
