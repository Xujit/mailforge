// src/services/mailer.js — Nodemailer transport + Handlebars rendering

const nodemailer = require("nodemailer");
const Handlebars = require("handlebars");

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.log(`📧  SMTP → ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  } else {
    const testAccount = await nodemailer.createTestAccount();
    _transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email", port: 587, secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("📧  Ethereal test account ready — preview at https://ethereal.email");
    console.log(`    User: ${testAccount.user}  Pass: ${testAccount.pass}`);
  }

  return _transporter;
}

function renderTemplate(templateStr, variables) {
  return Handlebars.compile(templateStr, { strict: false })(variables);
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from:    process.env.SMTP_FROM || '"MailForge" <noreply@mailforge.dev>',
    to, subject, html, text, replyTo,
  });
  return { messageId: info.messageId, previewUrl: nodemailer.getTestMessageUrl(info) || null };
}

module.exports = { renderTemplate, sendEmail };
