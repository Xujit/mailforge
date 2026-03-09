# MailForge

Multitenant templated email dispatch service.  
**Stack:** Node.js · Express · SQLite · Sequelize · Firebase Auth · React · Vite

---

## Repo Structure

```
mailforge/
├── backend/          Node.js/Express API
├── client/           React/Vite frontend
├── nginx/            Nginx site config
├── scripts/          VPS bootstrap script
├── .github/workflows CI/CD pipeline (GitHub Actions → DigitalOcean)
├── ecosystem.config.js  PM2 process config
└── DEPLOYMENT.md     Full deployment guide
```

## Quick Start (Local)

**Backend**
```bash
cd backend
npm install
cp .env.example .env     # fill in FIREBASE_SERVICE_ACCOUNT + ADMIN_KEY
npm start                # http://localhost:3000
```

**Frontend**
```bash
cd client
npm install
cp .env.example .env     # fill in VITE_FIREBASE_* keys
npm run dev              # http://localhost:5173
```

**Tests**
```bash
# In a separate terminal, with backend running:
cd backend && npm test
```

## Auth Flow

```
1. User signs up via Firebase (Email or Google)
2. Frontend POSTs Firebase ID token → POST /auth/me
3. User fills profile → POST /auth/register-profile
4. Admin approves → 7-day trial starts, welcome email sent
5. User logs in → accesses dashboard + API
6. Admin subscribes tenant (monthly/yearly) before trial ends
7. Warning email sent 3 days before expiry
8. Expired → all /v1/* calls return 402 until renewed
```

## API Keys

After approval, tenants receive a default `mk_live_...` API key.  
All `/v1/*` endpoints accept either a Firebase ID token or an API key as `Authorization: Bearer <token>`.

## Admin Endpoints

All require `Authorization: Bearer <ADMIN_KEY>` from `.env`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /admin/tenants | List tenants (filter by status) |
| GET | /admin/stats | Counts by status + subscription |
| POST | /admin/tenants/:id/approve | Approve + start 7-day trial |
| POST | /admin/tenants/:id/reject | Reject with reason |
| POST | /admin/tenants/:id/subscribe | Activate monthly/yearly plan |
| POST | /admin/tenants/:id/cancel | Cancel subscription |

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide.  
Push to `main` → GitHub Actions runs tests → builds frontend → deploys to VPS via SSH.

## Environment Variables

**backend/.env**
```env
PORT=3000
DB_PATH=data/mailforge.sqlite
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
ADMIN_KEY=your-admin-key
APP_URL=https://yourdomain.com
CLIENT_URL=https://yourdomain.com
SMTP_HOST=                        # blank = Ethereal test account
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="MailForge <noreply@yourdomain.com>"
```

**client/.env**
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_API_URL=https://yourdomain.com
```
