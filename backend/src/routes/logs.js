// src/routes/logs.js

const express = require("express");
const router  = express.Router();
const { Op }  = require("sequelize");
const { requireAuth } = require("../middleware/auth");
const { MessageLog } = require("../models");

// GET /v1/logs?limit=50&template_id=welcome_email&status=failed
router.get("/", requireAuth("send"), async (req, res) => {
  const { limit = 50, template_id, status } = req.query;

  const where = { tenantId: req.tenantId };
  if (template_id) where.templateSlug = template_id;
  if (status)      where.status = status;

  const logs = await MessageLog.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit: Math.min(parseInt(limit) || 50, 500),
  });

  res.json({ count: logs.length, logs });
});

// GET /v1/logs/:id
router.get("/:id", requireAuth("send"), async (req, res) => {
  const log = await MessageLog.findOne({
    where: { id: req.params.id, tenantId: req.tenantId },
  });
  if (!log) return res.status(404).json({ error: `Log '${req.params.id}' not found.` });
  res.json(log);
});

module.exports = router;
