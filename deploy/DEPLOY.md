# 🚀 ReservationInsiderPro Deployment Guide

## Prerequisites
- Hostinger VPS (Ubuntu recommended)
- SSH access to your VPS
- Your environment variables ready

---

## 🎯 Quick Deploy (5 Minutes)

### Step 1: SSH into your VPS
```bash
ssh root@YOUR_VPS_IP
```

### Step 2: Download and run the setup script
```bash
# Download the setup script directly
curl -o setup.sh https://raw.githubusercontent.com/abjohnson5f/ReservationInsiderPro/main/deploy/setup-vps.sh
chmod +x setup.sh
./setup.sh
```

### Step 3: Configure environment variables
```bash
nano /var/www/ReservationInsiderPro/server/.env
```

Add your variables:
```
NEON_DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
GEMINI_API_KEY=...
PORT=3000
NODE_ENV=production
```

### Step 4: Start the application
```bash
bash /var/www/ReservationInsiderPro/deploy/start-app.sh
```

### Step 5: Configure Nginx

**Without domain (IP only):**
```bash
bash /var/www/ReservationInsiderPro/deploy/configure-nginx.sh
```

**With domain:**
```bash
bash /var/www/ReservationInsiderPro/deploy/configure-nginx.sh yourdomain.com
```

### Step 6: Access your app! 🎉
- **Without domain:** `http://YOUR_VPS_IP`
- **With domain:** `https://yourdomain.com`

---

## 📋 Useful Commands

### Check application status
```bash
pm2 status
```

### View logs
```bash
pm2 logs reservation-api
```

### Restart application
```bash
pm2 restart reservation-api
```

### Update from GitHub
```bash
bash /var/www/ReservationInsiderPro/deploy/update-app.sh
```

### Check Nginx status
```bash
systemctl status nginx
```

---

## 🔒 Firewall Setup (Recommended)

```bash
# Allow SSH
ufw allow 22

# Allow HTTP and HTTPS
ufw allow 80
ufw allow 443

# Enable firewall
ufw enable
```

---

## 🔧 Troubleshooting

### App not starting?
```bash
# Check logs
pm2 logs reservation-api --lines 50

# Check if port is in use
lsof -i :3000
```

### Nginx not working?
```bash
# Test configuration
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
```

### Database connection issues?
- Verify NEON_DATABASE_URL in .env
- Check if Neon allows connections from your VPS IP

---

## 🔄 Auto-Deploy from GitHub (Optional)

Set up a webhook to auto-deploy on push:

```bash
# Install webhook
apt install webhook

# Create hook config
# (Advanced - ask if you want this set up)
```

---

## 📞 Support

If you run into issues:
1. Check `pm2 logs`
2. Check `/var/log/nginx/error.log`
3. Verify your .env file has all required variables

