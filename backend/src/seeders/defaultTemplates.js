// src/seeders/defaultTemplates.js
// Called after a tenant is approved — seeds 3 starter templates

const { Template } = require("../models");

const DEFAULT_TEMPLATES = [
  {
    slug: "welcome_email",
    subject: "Welcome to MailForge, {{name}}!",
    htmlBody: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h1 style="color:#6d28d9">Welcome aboard, {{name}}! 🎉</h1>
  <p>Your <strong>MailForge</strong> account has been approved. You can now log in and start sending.</p>
  <a href="{{login_url}}" style="display:inline-block;margin-top:16px;background:#6d28d9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard →</a>
  <p style="margin-top:24px;color:#64748b;font-size:13px">Tenant ID: <code>{{tenant_id}}</code></p>
</div>`,
    textBody: `Hi {{name}},\n\nYour MailForge account has been approved!\nLogin at: {{login_url}}\nTenant ID: {{tenant_id}}`,
    variables: ["name", "login_url", "tenant_id"],
  },
  {
    slug: "password_reset",
    subject: "Reset your password",
    htmlBody: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
  <h2>Password Reset</h2>
  <p>Click the link below — it expires in <strong>{{expiry_minutes}} minutes</strong>.</p>
  <p><a href="{{reset_link}}" style="color:#6d28d9">Reset Password</a></p>
  <p style="color:#64748b;font-size:12px">If you didn't request this, ignore this email.</p>
</div>`,
    textBody: `Reset your password (expires in {{expiry_minutes}} min): {{reset_link}}`,
    variables: ["reset_link", "expiry_minutes"],
  },
  {
    slug: "otp_code",
    subject: "Your verification code: {{otp}}",
    htmlBody: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;text-align:center">
  <h2>Verification Code</h2>
  <p style="font-size:40px;letter-spacing:10px;font-weight:bold;color:#6d28d9;margin:24px 0">{{otp}}</p>
  <p style="color:#64748b">Expires in {{expiry_minutes}} minutes.</p>
</div>`,
    textBody: `Your code: {{otp}} — expires in {{expiry_minutes}} minutes.`,
    variables: ["otp", "expiry_minutes"],
  },
];

async function seedDefaultTemplates(tenantId) {
  await Template.bulkCreate(
    DEFAULT_TEMPLATES.map(t => ({ ...t, tenantId })),
    { ignoreDuplicates: true }
  );
}

module.exports = { seedDefaultTemplates };
