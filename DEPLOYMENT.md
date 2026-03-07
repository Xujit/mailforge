# MailForge — Deployment Guide
## DigitalOcean VPS + GitHub Actions

---

## Repo Structure

```
your-repo/
├── .github/
│   └── workflows/
│       └── deploy.yml          ← CI/CD pipeline
├── backend/                    ← Node.js/Express API
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── .env.example
├── client/                     ← React/Vite frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── nginx/
│   └── mailforge.conf          ← Nginx site config
├── scripts/
│   └── setup-vps.sh            ← One-time VPS bootstrap
└── ecosystem.config.js         ← PM2 process config
```

---

## Step 1 — Create a DigitalOcean Droplet

1. Create an **Ubuntu 22.04** droplet (minimum: 1 vCPU, 1GB RAM)
2. Add your personal SSH key during creation so you can log in
3. Note the droplet's **IP address**

---

## Step 2 — Bootstrap the VPS

SSH in and run the setup script:

```bash
ssh root@YOUR_DROPLET_IP

# Create a non-root deploy user (recommended)
adduser deploy
usermod -aG sudo deploy
su - deploy

# Run the setup script
bash <(curl -s https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/scripts/setup-vps.sh)
```

---

## Step 3 — Clone Repo & Configure Environment

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /var/www/mailforge
cd /var/www/mailforge

# Backend environment
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in your `.env`:

```env
PORT=3000
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ADMIN_KEY=<strong-random-string>
APP_URL=https://yourdomain.com
CLIENT_URL=https://yourdomain.com

# SMTP (use Resend, SendGrid, etc.)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxx
SMTP_FROM="MailForge <noreply@yourdomain.com>"
```

---

## Step 4 — Configure Nginx

```bash
# Edit config — replace YOUR_DOMAIN_OR_IP
nano /var/www/mailforge/nginx/mailforge.conf

# Install
sudo cp /var/www/mailforge/nginx/mailforge.conf /etc/nginx/sites-available/mailforge
sudo ln -sf /etc/nginx/sites-available/mailforge /etc/nginx/sites-enabled/mailforge
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 5 — First Manual Deploy

```bash
cd /var/www/mailforge

# Install backend deps
cd backend && npm ci --omit=dev && cd ..

# Build frontend
cd client && npm ci && npm run build && cd ..

# Copy frontend build to web root
cp -r client/dist/* /var/www/mailforge/client/

# Start backend with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 logs mailforge-api   # verify it's running
```

---

## Step 6 — Generate Deploy SSH Key

On the VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/mailforge_deploy -N ""

# Authorize it
cat ~/.ssh/mailforge_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copy the PRIVATE key — you'll paste it into GitHub secrets
cat ~/.ssh/mailforge_deploy
```

---

## Step 7 — Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name     | Value                                         |
|-----------------|-----------------------------------------------|
| `VPS_HOST`      | Your droplet IP or domain (`123.456.789.0`)   |
| `VPS_USER`      | SSH username (`deploy` or `root`)             |
| `VPS_SSH_KEY`   | Contents of `~/.ssh/mailforge_deploy` (private key) |
| `VPS_PORT`      | `22` (default SSH port)                       |
| `VITE_API_URL`  | `https://yourdomain.com` (frontend API base)  |

---

## Step 8 — Enable HTTPS (Optional but Recommended)

```bash
# Point your domain's A record to the droplet IP first, then:
sudo certbot --nginx -d yourdomain.com

# Uncomment the HTTPS server block in nginx/mailforge.conf
```

---

## How the Pipeline Works

```
git push origin main
        ↓
┌─────────────────────────────────────────────┐
│  Job 1: test                                │
│  • npm ci in backend/                       │
│  • Start server, run tests/test.js          │
└───────────────────┬─────────────────────────┘
                    ↓ (only if tests pass)
┌─────────────────────────────────────────────┐
│  Job 2: build-frontend                      │
│  • npm ci && npm run build in client/       │
│  • Upload dist/ as artifact                 │
└───────────────────┬─────────────────────────┘
                    ↓ (both jobs must pass)
┌─────────────────────────────────────────────┐
│  Job 3: deploy                              │
│  • SCP frontend dist/ → VPS /var/www/       │
│  • SSH: git pull, npm ci, pm2 reload        │
│  • nginx reload                             │
└─────────────────────────────────────────────┘
```

Every `git push main` → fully automated zero-downtime deploy.

---

## Useful Commands on VPS

```bash
pm2 status                    # check process status
pm2 logs mailforge-api        # tail logs
pm2 restart mailforge-api     # restart manually
pm2 monit                     # live CPU/memory monitor

sudo nginx -t                 # test nginx config
sudo systemctl reload nginx   # reload nginx
sudo journalctl -u nginx -f   # nginx logs
```

---

## Rollback

```bash
# On the VPS — roll back to previous git commit
cd /var/www/mailforge
git log --oneline -5           # find the commit hash
git checkout <commit-hash>
pm2 reload mailforge-api
```
