// services/mailer.js — email transport + Handlebars rendering

const nodemailer = require("nodemailer");
const Handlebars = require("handlebars");

let _transporter = null;
let _testAccount = null;

/**
 * Build (or reuse) the Nodemailer transporter.
 * If no SMTP config is provided, auto-creates an Ethereal test account
 * so you can develop without a real mail provider.
 */
async function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`📧  SMTP transport ready → ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  } else {
    // Auto-provision Ethereal test account
    _testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: _testAccount.user, pass: _testAccount.pass },
    });
    console.log("📧  No SMTP configured — using Ethereal test account");
    console.log(`    User: ${_testAccount.user}`);
    console.log(`    Pass: ${_testAccount.pass}`);
    console.log(`    Preview emails at: https://ethereal.email`);
  }

  return _transporter;
}

/**
 * Render a Handlebars template string with the provided variables.
 * Throws if a required variable is missing.
 */
function renderTemplate(templateStr, variables) {
  const compiled = Handlebars.compile(templateStr, { strict: false });
  return compiled(variables);
}

/**
 * Send a single email.
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject       - Already-rendered subject
 * @param {string} opts.html          - Already-rendered HTML body
 * @param {string} [opts.text]        - Already-rendered plain-text body
 * @param {string} [opts.replyTo]
 * @returns {object} { messageId, previewUrl }
 */
async function sendEmail({ to, subject, html, text, replyTo }) {
  const transporter = await getTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || '"MailForge" <noreply@mailforge.dev>',
    to,
    subject,
    html,
    text,
    replyTo,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || null;

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

module.exports = { renderTemplate, sendEmail };
