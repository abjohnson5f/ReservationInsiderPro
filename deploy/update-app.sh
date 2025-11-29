#!/bin/bash
# ==============================================
# Update Application from GitHub
# Run whenever you push new code
# ==============================================

set -e

APP_DIR="/var/www/ReservationInsiderPro"

echo "🔄 Updating ReservationInsiderPro..."

cd $APP_DIR

# Pull latest code
echo "📥 Pulling latest from GitHub..."
git pull origin main

# Update backend
echo "📦 Updating backend..."
cd server
npm install
npm run build

# Update frontend
echo "📦 Updating frontend..."
cd ../client
npm install
npm run build

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart reservation-api

echo ""
echo "✅ Update complete!"
echo "📊 Check status: pm2 status"
echo ""

