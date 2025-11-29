# Booking Automation Setup Guide

This guide explains how to configure the automated reservation acquisition system using Bright Data and the built-in booking bot.

## Overview

The system supports two automation modes:

1. **Bright Data Scraping Browser** (Recommended) - Handles CAPTCHAs automatically, browser fingerprint randomization, and residential IP rotation
2. **Local Puppeteer + Proxy** - Fallback option using residential proxies

## Required Environment Variables

Add these to your `.env` file:

### Bright Data Configuration

```bash
# Option 1: Scraping Browser (Recommended)
# Get from: https://brightdata.com/products/scraping-browser
# Format: wss://brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD@brd.superproxy.io:9222
BRIGHTDATA_SCRAPING_BROWSER=wss://brd-customer-hl_xxxxx-zone-scraping_browser1:password@brd.superproxy.io:9222

# Option 2: Residential Proxy (Fallback)
# Format: http://username:password@host:port
PROXY_URL=http://brd-customer-hl_xxxxx-zone-residential:password@brd.superproxy.io:22225
```

### Platform Credentials

```bash
# Resy Account (Most Common)
RESY_EMAIL=your_email@example.com
RESY_PASSWORD=your_resy_password

# OpenTable Account (optional)
OPENTABLE_EMAIL=your_email@example.com
OPENTABLE_PASSWORD=your_opentable_password

# Tock Account (optional)
TOCK_EMAIL=your_email@example.com
TOCK_PASSWORD=your_tock_password
```

### Telegram Notifications

```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Bright Data Setup

### 1. Create Account
Go to [brightdata.com](https://brightdata.com) and create an account.

### 2. Create Scraping Browser Zone
1. Navigate to "Proxies & Scraping" → "Scraping Browser"
2. Create a new zone (e.g., "resy_sniper")
3. Copy the connection string (starts with `wss://`)

### 3. Configure IP Rotation
For restaurant booking, set:
- **Session type**: Rotating (new IP per request)
- **Country**: United States (or target country)
- **State/City**: Match the restaurant's city for best results

### 4. Test Connection
```bash
curl -X POST http://localhost:3000/api/sniper/bot/test
```

Expected response:
```json
{
  "success": true,
  "ip": "x.x.x.x"
}
```

## Platform Booking Flows

### Resy (Fully Implemented)
1. Navigate to restaurant booking URL
2. Detect available time slots
3. Click target time or first available
4. Handle authentication if needed
5. Confirm reservation
6. Send Telegram notification

### OpenTable (Implemented)
1. Navigate to restaurant page
2. Find available time slots
3. Click and confirm

### Tock (Partial - Prepaid)
1. Navigate to restaurant page
2. Select time slot
3. Add to cart
4. Proceed to checkout
5. **Note**: Requires manual payment completion

## API Endpoints

### Test Bot Connection
```bash
POST /api/sniper/bot/test
```

### Manual Acquisition
```bash
POST /api/sniper/bot/acquire
Content-Type: application/json

{
  "restaurantName": "Carbone",
  "bookingUrl": "https://resy.com/cities/ny/carbone",
  "date": "2024-12-20",
  "time": "19:00",
  "partySize": 2,
  "platform": "resy"
}
```

### Launch Browser (Pre-warm)
```bash
POST /api/sniper/bot/launch
```

### Close Browser
```bash
POST /api/sniper/bot/close
```

## Scheduler Integration

The scheduler automatically triggers the acquisition bot at drop times:

1. Add a restaurant to your watchlist with status `WATCHING`
2. Set `next_drop_date`, `next_drop_time`, and `drop_timezone`
3. Start the scheduler: `POST /api/sniper/start`
4. The system will:
   - Send T-5 minute warning via Telegram
   - Send T-1 minute warning via Telegram
   - Execute acquisition bot at drop time
   - Update status to `ACQUIRED` or `PENDING_CONFIRMATION`

## Debugging

### Enable Visible Browser
Set in `.env`:
```bash
PUPPETEER_HEADLESS=false
```

### View Logs
The acquisition bot logs detailed output:
```
[AcquisitionBot] 🎯 Starting Resy acquisition flow...
[AcquisitionBot] Page loaded
[AcquisitionBot] Found 5 available slots
[AcquisitionBot] ✅ Found matching slot: 7:00 PM
[AcquisitionBot] Clicked reservation slot
[AcquisitionBot] ✅ Reservation confirmed!
```

## Troubleshooting

### "No slots available"
- Inventory may not have dropped yet
- Check the drop time and timezone
- Verify the booking URL is correct

### "Authentication required"
- Set RESY_EMAIL and RESY_PASSWORD in `.env`
- Ensure account is not locked/banned

### "Connection failed"
- Verify Bright Data credentials
- Check zone is active and has credits
- Try the test connection endpoint

### CAPTCHAs
- Scraping Browser handles these automatically
- If using local Puppeteer, switch to Scraping Browser


