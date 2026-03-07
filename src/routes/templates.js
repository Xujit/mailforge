// routes/templates.js — tenant-scoped template CRUD

const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const store = require("../store");

function detectVars(str) {
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "").trim()))];
}

router.get("/", requireAuth("templates"), (req, res) => {
  const list = store.listTemplates(req.tenantId).map(t => ({
    id: t.id, subject: t.subject, variables: t.variables, sends: t.sends, updatedAt: t.updatedAt,
  }));
  res.json({ count: list.length, templates: list });
});

router.get("/:id", requireAuth("templates"), (req, res) => {
  const t = store.getTemplate(req.tenantId, req.params.id);
  if (!t) return res.status(404).json({ error: `Template '${req.params.id}' not found.` });
  res.json(t);
});

router.post("/", requireAuth("templates"), (req, res) => {
  const { id, subject, html_body, text_body, variables } = req.body;
  if (!id)        return res.status(400).json({ error: "'id' is required." });
  if (!subject)   return res.status(400).json({ error: "'subject' is required." });
  if (!html_body) return res.status(400).json({ error: "'html_body' is required." });

  const detectedVars = variables || detectVars(subject + html_body + (text_body || ""));
  const record = store.upsertTemplate({ tenantId: req.tenantId, id, subject, htmlBody: html_body, textBody: text_body || "", variables: detectedVars });
  res.status(201).json(record);
});

router.put("/:id", requireAuth("templates"), (req, res) => {
  const { subject, html_body, text_body, variables } = req.body;
  if (!subject || !html_body) return res.status(400).json({ error: "'subject' and 'html_body' are required." });
  const detectedVars = variables || detectVars(subject + html_body + (text_body || ""));
  const record = store.upsertTemplate({ tenantId: req.tenantId, id: req.params.id, subject, htmlBody: html_body, textBody: text_body || "", variables: detectedVars });
  res.json(record);
});

router.delete("/:id", requireAuth("templates"), (req, res) => {
  const deleted = store.deleteTemplate(req.tenantId, req.params.id);
  if (!deleted) return res.status(404).json({ error: `Template '${req.params.id}' not found.` });
  res.json({ deleted: true, id: req.params.id });
});

module.exports = router;
