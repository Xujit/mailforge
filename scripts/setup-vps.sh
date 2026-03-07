#!/bin/bash
# scripts/setup-vps.sh
# Run this ONCE on a fresh DigitalOcean droplet (Ubuntu 22.04+)
# as root or a sudo user:
#   bash scripts/setup-vps.sh

set -e
echo "🚀  MailForge VPS Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System packages ────────────────────────────────────────────
echo "▶ Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

apt-get install -y -qq \
  curl git nginx ufw certbot python3-certbot-nginx \
  build-essential

# ── 2. Node.js 20 via NodeSource ─────────────────────────────────
echo "▶ Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── 3. PM2 ───────────────────────────────────────────────────────
echo "▶ Installing PM2..."
npm install -g pm2
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER

# ── 4. App directories ───────────────────────────────────────────
echo "▶ Creating app directories..."
mkdir -p /var/www/mailforge/client
mkdir -p /var/log/mailforge
chown -R $SUDO_USER:$SUDO_USER /var/www/mailforge /var/log/mailforge

# ── 5. Clone repo ────────────────────────────────────────────────
echo ""
echo "▶ Clone your repo into /var/www/mailforge:"
echo "   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git /var/www/mailforge"
echo "   cd /var/www/mailforge"
echo "   cp backend/.env.example backend/.env"
echo "   nano backend/.env   # fill in JWT_SECRET, ADMIN_KEY, SMTP settings"
echo ""

# ── 6. Nginx ─────────────────────────────────────────────────────
echo "▶ Configuring Nginx..."
# Copy config (assumes you've cloned the repo already)
# cp /var/www/mailforge/nginx/mailforge.conf /etc/nginx/sites-available/mailforge
# ln -sf /etc/nginx/sites-available/mailforge /etc/nginx/sites-enabled/mailforge
# rm -f /etc/nginx/sites-enabled/default
# nginx -t && systemctl reload nginx

echo "   After cloning, run:"
echo "   cp /var/www/mailforge/nginx/mailforge.conf /etc/nginx/sites-available/mailforge"
echo "   nano /etc/nginx/sites-available/mailforge  # set your domain/IP"
echo "   ln -sf /etc/nginx/sites-available/mailforge /etc/nginx/sites-enabled/mailforge"
echo "   rm -f /etc/nginx/sites-enabled/default"
echo "   nginx -t && systemctl reload nginx"
echo ""

# ── 7. Firewall ───────────────────────────────────────────────────
echo "▶ Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 8. SSL (optional, needs a domain) ────────────────────────────
echo ""
echo "▶ To enable HTTPS (after pointing your domain to this IP):"
echo "   certbot --nginx -d yourdomain.com"
echo ""

# ── 9. GitHub Actions SSH key ─────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▶ Generate a deploy SSH key for GitHub Actions:"
echo ""
echo "   ssh-keygen -t ed25519 -C 'github-actions-deploy' -f ~/.ssh/mailforge_deploy"
echo "   cat ~/.ssh/mailforge_deploy.pub >> ~/.ssh/authorized_keys"
echo "   cat ~/.ssh/mailforge_deploy        # copy this → GitHub secret VPS_SSH_KEY"
echo ""
echo "✅  Base setup done!"
echo "    Next: clone repo, fill .env, set GitHub secrets (see DEPLOYMENT.md)"
