#!/bin/bash
# ==============================================
# ReservationInsiderPro - Start Application
# Run after setup and .env configuration
# ==============================================

set -e

APP_DIR="/var/www/ReservationInsiderPro"

echo "🚀 Starting ReservationInsiderPro..."

cd $APP_DIR/server

# Stop existing PM2 processes if any
pm2 delete reservation-api 2>/dev/null || true

# Start the backend with PM2
echo "▶️ Starting backend API..."
pm2 start dist/index.js --name "reservation-api" --env production

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u root --hp /root

echo ""
echo "✅ Application Started!"
echo ""
echo "📊 Check status: pm2 status"
echo "📋 View logs: pm2 logs reservation-api"
echo "🔄 Restart: pm2 restart reservation-api"
echo ""

