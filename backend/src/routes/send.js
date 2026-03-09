// src/routes/send.js

const express    = require("express");
const router     = express.Router();
const { v4: uuidv4 } = require("uuid");
const { Template, MessageLog } = require("../models");
const { renderTemplate, sendEmail } = require("../services/mailer");

router.post("/", async (req, res) => {
  const { tenantId } = req;
  const { template_id, to, variables = {}, reply_to } = req.body;

  if (!template_id) return res.status(400).json({ error: "'template_id' is required." });
  if (!to)          return res.status(400).json({ error: "'to' is required." });

  const recipients = Array.isArray(to) ? to : [to];
  if (recipients.length === 0)  return res.status(400).json({ error: "'to' must not be empty." });
  if (recipients.length > 50)   return res.status(400).json({ error: "Max 50 recipients per request." });

  // Look up template scoped to this tenant
  const template = await Template.findOne({ where: { tenantId, slug: template_id } });
  if (!template) return res.status(404).json({ error: `Template '${template_id}' not found.` });

  // Warn about missing variables (non-fatal)
  const missing = template.variables.filter(v => !(v in variables));

  // Render
  let renderedSubject, renderedHtml, renderedText;
  try {
    renderedSubject = renderTemplate(template.subject,  variables);
    renderedHtml    = renderTemplate(template.htmlBody, variables);
    renderedText    = template.textBody ? renderTemplate(template.textBody, variables) : undefined;
  } catch (err) {
    return res.status(422).json({ error: "Template rendering failed.", detail: err.message });
  }

  const results = [];

  for (const recipient of recipients) {
    let status = "delivered", messageId = null, previewUrl = null, errorMsg = null;

    try {
      const sent = await sendEmail({
        to: recipient, subject: renderedSubject,
        html: renderedHtml, text: renderedText, replyTo: reply_to,
      });
      messageId  = sent.messageId;
      previewUrl = sent.previewUrl;
    } catch (err) {
      status   = "failed";
      errorMsg = err.message;
    }

    // Persist log entry
    const logEntry = await MessageLog.create({
      id:           "msg_" + uuidv4().replace(/-/g, "").slice(0, 10),
      tenantId,
      templateSlug: template_id,
      to:           recipient,
      subject:      renderedSubject,
      status,
      messageId,
      previewUrl,
      error:        errorMsg,
      apiKeyLabel:  req.apiKey?.label || "jwt",
      variables,
    });

    // Increment send counter on the template
    if (status === "delivered") {
      await template.increment("sends");
    }

    results.push({
      id:         logEntry.id,
      to:         recipient,
      status,
      message_id: messageId,
      ...(previewUrl ? { preview_url: previewUrl } : {}),
      ...(errorMsg   ? { error: errorMsg }          : {}),
    });
  }

  const allOk = results.every(r => r.status === "delivered");
  const anyOk = results.some(r => r.status === "delivered");

  return res.status(allOk ? 200 : anyOk ? 207 : 500).json({
    template_id,
    ...(missing.length ? { warnings: { missing_variables: missing } } : {}),
    results,
  });
});

module.exports = router;
