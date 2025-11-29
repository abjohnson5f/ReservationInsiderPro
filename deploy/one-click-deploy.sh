#!/bin/bash
# ==============================================
# ONE-CLICK DEPLOYMENT SCRIPT
# Run this single command on your fresh VPS:
#
# curl -sL https://raw.githubusercontent.com/abjohnson5f/ReservationInsiderPro/main/deploy/one-click-deploy.sh | bash
# ==============================================

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     🚀 ReservationInsiderPro - One-Click Deployment      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Update system
echo -e "${YELLOW}[1/8]${NC} Updating system packages..."
apt update && apt upgrade -y

# Step 2: Install Node.js
echo -e "${YELLOW}[2/8]${NC} Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Step 3: Install tools
echo -e "${YELLOW}[3/8]${NC} Installing PM2, Nginx, Git..."
npm install -g pm2
apt install -y nginx git certbot python3-certbot-nginx

# Step 4: Clone repo
echo -e "${YELLOW}[4/8]${NC} Cloning repository..."
mkdir -p /var/www
cd /var/www
rm -rf ReservationInsiderPro 2>/dev/null || true
git clone https://github.com/abjohnson5f/ReservationInsiderPro.git
cd ReservationInsiderPro

# Step 5: Build backend
echo -e "${YELLOW}[5/8]${NC} Building backend..."
cd server
npm install
npm run build

# Step 6: Build frontend
echo -e "${YELLOW}[6/8]${NC} Building frontend..."
cd ../client
npm install
npm run build

# Step 7: Configure Nginx (IP only for now)
echo -e "${YELLOW}[7/8]${NC} Configuring Nginx..."
cat > /etc/nginx/sites-available/reservation-insider << 'NGINX'
server {
    listen 80;
    server_name _;
    root /var/www/ReservationInsiderPro/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/reservation-insider /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx

# Step 8: Create .env template
echo -e "${YELLOW}[8/8]${NC} Creating .env template..."
cat > /var/www/ReservationInsiderPro/server/.env << 'ENV'
# === REQUIRED ===
NEON_DATABASE_URL=YOUR_NEON_URL_HERE
PORT=3000
NODE_ENV=production

# === TELEGRAM ===
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID

# === AI ===
GEMINI_API_KEY=YOUR_GEMINI_KEY
ENV

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ DEPLOYMENT COMPLETE!                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Configure your environment variables:${NC}"
echo ""
echo "   nano /var/www/ReservationInsiderPro/server/.env"
echo ""
echo "Then start the app:"
echo ""
echo "   cd /var/www/ReservationInsiderPro/server"
echo "   pm2 start dist/index.js --name reservation-api"
echo "   pm2 save && pm2 startup"
echo ""
echo -e "Your app will be available at: ${GREEN}http://$(curl -s ifconfig.me)${NC}"
echo ""

