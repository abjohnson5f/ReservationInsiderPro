/**
 * Notification API Routes
 * 
 * Endpoints for Telegram and other notification services
 */

import { Router } from 'express';
import telegram from '../sniper/telegram';
import pricingEngine from '../services/pricingEngine';
import pool from '../db';

const router = Router();

/**
 * GET /api/notifications/status
 * Get notification service status
 */
router.get('/status', (req, res) => {
  const telegramStatus = telegram.getConfigStatus();
  
  res.json({
    success: true,
    telegram: telegramStatus,
    services: {
      telegram: telegramStatus.ready,
      email: false,  // Not implemented yet
      sms: false,    // Not implemented yet
    }
  });
});

/**
 * POST /api/notifications/test
 * Send a test notification
 */
router.post('/test', async (req, res) => {
  try {
    const result = await telegram.sendTest();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/telegram/send
 * Send a custom Telegram message
 */
router.post('/telegram/send', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    
    const result = await telegram.send(message);
    res.json({ success: !!result, messageId: result?.message_id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/acquisition
 * Notify about an acquisition
 */
router.post('/acquisition', async (req, res) => {
  try {
    const { restaurantName, price, date, time, partySize, platform, confirmationCode } = req.body;
    
    // Get price suggestion
    let suggestedPrice;
    if (restaurantName && date && time && partySize) {
      const priceSuggestion = await pricingEngine.getSuggestedPrice({
        restaurantName,
        platform: platform || 'resy',
        reservationDate: date,
        reservationTime: time,
        partySize,
      });
      suggestedPrice = priceSuggestion.suggestedPrice;
    }
    
    const details = [
      `📅 ${date} at ${time}`,
      `👥 ${partySize} guests`,
      `📱 ${platform || 'Unknown'}`,
      confirmationCode ? `🔑 ${confirmationCode}` : '',
      suggestedPrice ? `💡 Suggested AT price: $${suggestedPrice}` : '',
    ].filter(Boolean).join('\n');
    
    await telegram.notifyAcquired(restaurantName, price, details);
    
    res.json({ success: true, suggestedPrice });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/listed
 * Notify about a listing
 */
router.post('/listed', async (req, res) => {
  try {
    const { restaurantName, price, date, listingUrl } = req.body;
    await telegram.notifyListed(restaurantName, price, date, listingUrl);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/sold
 * Notify about a sale
 */
router.post('/sold', async (req, res) => {
  try {
    const { restaurantName, salePrice, buyerName, profit } = req.body;
    await telegram.notifySold(restaurantName, salePrice, buyerName, profit);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/transfer-reminder
 * Notify about a pending transfer
 */
router.post('/transfer-reminder', async (req, res) => {
  try {
    const { restaurantName, buyerName, deadline, method } = req.body;
    await telegram.notifyTransferReminder(restaurantName, buyerName, deadline, method);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/transfer-complete
 * Notify about a completed transfer
 */
router.post('/transfer-complete', async (req, res) => {
  try {
    const { restaurantName, buyerName } = req.body;
    await telegram.notifyTransferComplete(restaurantName, buyerName);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/daily-summary
 * Send daily summary
 */
router.post('/daily-summary', async (req, res) => {
  try {
    // Get stats from database
    let stats = {
      acquisitions: 0,
      sales: 0,
      revenue: 0,
      pendingTransfers: 0,
    };
    
    if (pool) {
      const client = await pool.connect();
      try {
        // Today's acquisitions
        const acqResult = await client.query(`
          SELECT COUNT(*) as count FROM acquisition_attempts
          WHERE success = true AND DATE(created_at) = CURRENT_DATE
        `);
        stats.acquisitions = parseInt(acqResult.rows[0]?.count) || 0;
        
        // Today's sales
        const salesResult = await client.query(`
          SELECT COUNT(*) as count, COALESCE(SUM(sale_price), 0) as revenue
          FROM transfers
          WHERE status IN ('SOLD', 'COMPLETED')
            AND DATE(sold_at) = CURRENT_DATE
        `);
        stats.sales = parseInt(salesResult.rows[0]?.count) || 0;
        stats.revenue = parseFloat(salesResult.rows[0]?.revenue) || 0;
        
        // Pending transfers
        const pendingResult = await client.query(`
          SELECT COUNT(*) as count FROM transfers
          WHERE status = 'TRANSFER_PENDING'
        `);
        stats.pendingTransfers = parseInt(pendingResult.rows[0]?.count) || 0;
      } finally {
        client.release();
      }
    }
    
    await telegram.notifyDailySummary(stats);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/price-suggestion
 * Send price suggestion notification
 */
router.post('/price-suggestion', async (req, res) => {
  try {
    const { restaurantName, reservationDate, reservationTime, partySize, platform } = req.body;
    
    const suggestion = await pricingEngine.getSuggestedPrice({
      restaurantName,
      platform: platform || 'resy',
      reservationDate,
      reservationTime,
      partySize,
    });
    
    await telegram.notifyPriceSuggestion(
      restaurantName,
      suggestion.suggestedPrice,
      suggestion.confidence,
      suggestion.reasoning
    );
    
    res.json({ success: true, suggestion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/notifications/polling/start
 * Start Telegram polling for commands
 */
router.post('/polling/start', (req, res) => {
  telegram.startPolling();
  res.json({ success: true, message: 'Polling started' });
});

/**
 * POST /api/notifications/polling/stop
 * Stop Telegram polling
 */
router.post('/polling/stop', (req, res) => {
  telegram.stopPolling();
  res.json({ success: true, message: 'Polling stopped' });
});

export default router;

