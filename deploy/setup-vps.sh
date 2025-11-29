#!/bin/bash
# ==============================================
# ReservationInsiderPro - VPS Setup Script
# Run this ONCE on a fresh Hostinger VPS
# ==============================================

set -e  # Exit on error

echo "🚀 ReservationInsiderPro VPS Setup"
echo "=================================="

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install PM2 globally
echo "📦 Installing PM2 process manager..."
npm install -g pm2

# Install Nginx
echo "📦 Installing Nginx..."
apt install -y nginx

# Install Certbot for SSL
echo "📦 Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx

# Install Git
echo "📦 Installing Git..."
apt install -y git

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /var/www
cd /var/www

# Clone repository
echo "📥 Cloning repository..."
if [ -d "ReservationInsiderPro" ]; then
    echo "Repository exists, pulling latest..."
    cd ReservationInsiderPro
    git pull origin main
else
    git clone https://github.com/abjohnson5f/ReservationInsiderPro.git
    cd ReservationInsiderPro
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd server
npm install

# Build backend (TypeScript to JavaScript)
echo "🔨 Building backend..."
npm run build

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../client
npm install

# Build frontend
echo "🔨 Building frontend..."
npm run build

echo ""
echo "✅ VPS Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Run: nano /var/www/ReservationInsiderPro/server/.env"
echo "2. Add your environment variables"
echo "3. Run: bash /var/www/ReservationInsiderPro/deploy/start-app.sh"
echo ""

