// src/routes/templates.js

const express = require("express");
const router  = express.Router();
const { requireAuth } = require("../middleware/auth");
const { Template } = require("../models");

function detectVars(str) {
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "").trim()))];
}

function fmt(t) {
  return {
    id:        t.slug,
    subject:   t.subject,
    htmlBody:  t.htmlBody,
    textBody:  t.textBody,
    variables: t.variables,
    sends:     t.sends,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

// GET /v1/templates
router.get("/", requireAuth("templates"), async (req, res) => {
  const list = await Template.findAll({
    where: { tenantId: req.tenantId },
    order: [["createdAt", "DESC"]],
  });
  res.json({ count: list.length, templates: list.map(fmt) });
});

// GET /v1/templates/:id
router.get("/:id", requireAuth("templates"), async (req, res) => {
  const t = await Template.findOne({ where: { tenantId: req.tenantId, slug: req.params.id } });
  if (!t) return res.status(404).json({ error: `Template '${req.params.id}' not found.` });
  res.json(fmt(t));
});

// POST /v1/templates — create or update (upsert by slug)
router.post("/", requireAuth("templates"), async (req, res) => {
  const { id, subject, html_body, text_body, variables } = req.body;
  if (!id)        return res.status(400).json({ error: "'id' is required." });
  if (!subject)   return res.status(400).json({ error: "'subject' is required." });
  if (!html_body) return res.status(400).json({ error: "'html_body' is required." });

  if (!/^[a-z0-9_-]+$/i.test(id))
    return res.status(400).json({ error: "'id' may only contain letters, numbers, underscores and hyphens." });

  const vars = variables || detectVars(subject + html_body + (text_body || ""));

  const [template, created] = await Template.upsert({
    tenantId: req.tenantId,
    slug:     id,
    subject,
    htmlBody: html_body,
    textBody: text_body || "",
    variables: vars,
  }, { returning: true });

  res.status(created ? 201 : 200).json(fmt(template));
});

// PUT /v1/templates/:id
router.put("/:id", requireAuth("templates"), async (req, res) => {
  const { subject, html_body, text_body, variables } = req.body;
  if (!subject || !html_body)
    return res.status(400).json({ error: "'subject' and 'html_body' are required." });

  const t = await Template.findOne({ where: { tenantId: req.tenantId, slug: req.params.id } });
  if (!t) return res.status(404).json({ error: `Template '${req.params.id}' not found.` });

  const vars = variables || detectVars(subject + html_body + (text_body || ""));
  await t.update({ subject, htmlBody: html_body, textBody: text_body || "", variables: vars });
  res.json(fmt(t));
});

// DELETE /v1/templates/:id
router.delete("/:id", requireAuth("templates"), async (req, res) => {
  const t = await Template.findOne({ where: { tenantId: req.tenantId, slug: req.params.id } });
  if (!t) return res.status(404).json({ error: `Template '${req.params.id}' not found.` });
  await t.destroy();
  res.json({ deleted: true, id: req.params.id });
});

module.exports = router;
