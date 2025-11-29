#!/bin/bash
# ==============================================
# Configure Nginx
# Run after setup-vps.sh
# ==============================================

set -e

DEPLOY_DIR="/var/www/ReservationInsiderPro/deploy"

echo "🔧 Configuring Nginx..."

# Check if domain is provided as argument
if [ -z "$1" ]; then
    echo "No domain provided, using IP-only configuration..."
    cp $DEPLOY_DIR/nginx-ip-only.conf /etc/nginx/sites-available/reservation-insider
else
    DOMAIN=$1
    echo "Domain provided: $DOMAIN"
    
    # Copy and customize domain config
    sed "s/YOUR_DOMAIN/$DOMAIN/g" $DEPLOY_DIR/nginx-domain.conf > /etc/nginx/sites-available/reservation-insider
    
    # Get SSL certificate
    echo "🔒 Obtaining SSL certificate..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
fi

# Enable the site
ln -sf /etc/nginx/sites-available/reservation-insider /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx

echo ""
echo "✅ Nginx configured!"
echo ""

