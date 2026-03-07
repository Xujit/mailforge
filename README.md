# MailForge 📧

A lightweight, self-hosted email dispatch service. Send templated emails via a simple REST API — similar to Mailgun/Resend, but yours to own and extend.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — leave SMTP blank to use Ethereal (auto test account, no setup needed)

# 3. Start the server
npm start
# → http://localhost:3000

# 4. Run tests (in a second terminal)
npm test
```

---

## Authentication

All endpoints require a `Bearer` token:

```
Authorization: Bearer <api_key>
```

Two keys are pre-seeded on startup:

| Key | Label | Scopes |
|---|---|---|
| `mk_admin_changeme_before_production` | Admin | send, templates, keys |
| `mk_dev_testkey123` | Dev / Testing | send, templates |

> ⚠️ Change the admin key via `ADMIN_KEY` in `.env` before going to production.

---

## Endpoints

### Send Email

**`POST /v1/send`** — scope: `send`

```json
{
  "template_id": "welcome_email",
  "to": "jane@example.com",
  "variables": {
    "first_name": "Jane",
    "product_name": "Acme",
    "cta_url": "https://acme.com/start"
  },
  "reply_to": "support@acme.com"
}
```

`to` can be a string or an array (max 50 recipients).

**Response:**
```json
{
  "template_id": "welcome_email",
  "results": [
    {
      "id": "msg_abc123",
      "to": "jane@example.com",
      "status": "delivered",
      "message_id": "<xyz@mailforge>",
      "preview_url": "https://ethereal.email/message/..."
    }
  ]
}
```

---

### Templates

**`GET /v1/templates`** — list all templates  
**`GET /v1/templates/:id`** — get one template  
**`POST /v1/templates`** — create or update  
**`PUT /v1/templates/:id`** — replace  
**`DELETE /v1/templates/:id`** — delete  

Scope required: `templates`

**Create/Update body:**
```json
{
  "id": "invoice_ready",
  "subject": "Your invoice #{{invoice_id}} is ready",
  "html_body": "<p>Hi {{name}}, your invoice for {{amount}} is due on {{due_date}}.</p>",
  "text_body": "Hi {{name}}, invoice {{invoice_id}} for {{amount}} due {{due_date}}.",
  "variables": ["name", "invoice_id", "amount", "due_date"]
}
```

> Variables are **auto-detected** from `{{variable}}` syntax if you omit `variables`.

---

### API Keys

**`GET /v1/keys`** — list keys (redacted)  
**`POST /v1/keys`** — create a key  
**`DELETE /v1/keys/:key`** — revoke a key  

Scope required: `keys`

**Create key body:**
```json
{
  "label": "Mobile App",
  "scopes": ["send"]
}
```

Valid scopes: `send`, `templates`, `keys`

---

### Logs

**`GET /v1/logs`** — list delivery logs  
**`GET /v1/logs/:id`** — single log entry  

Query params: `?limit=50&template_id=welcome_email&status=failed`

Scope required: `send`

---

## Templates

Templates use **Handlebars** syntax:

- Variables: `{{first_name}}`
- Conditionals: `{{#if trial}}Your trial ends soon{{/if}}`
- Loops: `{{#each items}}<li>{{this}}</li>{{/each}}`

---

## SMTP Providers

| Provider | SMTP Host | Port |
|---|---|---|
| Gmail | smtp.gmail.com | 587 |
| Resend | smtp.resend.com | 587 |
| SendGrid | smtp.sendgrid.net | 587 |
| Mailgun | smtp.mailgun.org | 587 |
| Ethereal (test) | auto-configured | — |

---

## Project Structure

```
mailforge/
├── src/
│   ├── index.js              # Express app + startup
│   ├── store.js              # In-memory data store
│   ├── middleware/
│   │   └── auth.js           # API key validation
│   ├── routes/
│   │   ├── send.js           # POST /v1/send
│   │   ├── templates.js      # CRUD /v1/templates
│   │   ├── keys.js           # /v1/keys
│   │   └── logs.js           # /v1/logs
│   └── services/
│       └── mailer.js         # Nodemailer + Handlebars
├── tests/
│   └── test.js               # Integration tests
├── .env.example
├── package.json
└── README.md
```

---

## Production Checklist

- [ ] Replace in-memory store with PostgreSQL or MongoDB
- [ ] Change `ADMIN_KEY` in `.env`
- [ ] Configure real SMTP credentials
- [ ] Add rate limiting (e.g. `express-rate-limit`)
- [ ] Add request logging (e.g. `morgan`)
- [ ] Deploy behind HTTPS reverse proxy (nginx / Caddy)
- [ ] Add webhook callbacks for delivery status
