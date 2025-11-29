/**
 * Sniper API Routes
 * 
 * Endpoints for controlling the Sniper system:
 * - Test notifications
 * - Start/stop scheduler
 * - Check sniper status
 * - Trigger manual actions
 * - Resy API integration (PRODUCTION-READY)
 */

import { Router } from 'express';
import notifications from '../sniper/notifications';
import telegram from '../sniper/telegram';
import scheduler from '../sniper/scheduler';
import acquisitionBot from '../sniper/acquisitionBot';
import voiceAgent from '../sniper/voiceAgent';
import resyClient from '../services/resyApi';
import openTableClient from '../services/openTableApi';
import sevenRoomsClient from '../services/sevenRoomsApi';
import tockClient from '../services/tockApi';
import acquisitionEngine from '../services/acquisitionEngine';
import type { Platform } from '../services/acquisitionEngine';

const router = Router();

/**
 * GET /api/sniper/status
 * Check if sniper services are configured and running
 */
router.get('/status', (req, res) => {
  const schedulerStatus = scheduler.getStatus();
  
  const telegramStatus = telegram.getConfigStatus();
  
  const status = {
    telegram: telegramStatus.ready,
    telegramPolling: telegramStatus.polling,
    twilioLegacy: notifications.isConfigured(),
    scheduler: schedulerStatus.isRunning,
    puppeteer: acquisitionBot.isConfigured(),
    puppeteerProxy: acquisitionBot.hasProxy(),
    voiceAgent: voiceAgent.isConfigured()
  };

  res.json({
    status: 'operational',
    services: status,
    scheduler: {
      running: schedulerStatus.isRunning,
      watchedCount: schedulerStatus.watchedCount,
      nextDrop: schedulerStatus.nextDrop
    },
    message: status.telegram 
      ? 'Sniper system ready' 
      : 'Telegram not configured - set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env'
  });
});

/**
 * POST /api/sniper/start
 * Start the scheduler
 */
router.post('/start', (req, res) => {
  scheduler.start();
  const status = scheduler.getStatus();
  res.json({ 
    success: true, 
    message: 'Scheduler started',
    status 
  });
});

/**
 * POST /api/sniper/stop
 * Stop the scheduler
 */
router.post('/stop', (req, res) => {
  scheduler.stop();
  res.json({ 
    success: true, 
    message: 'Scheduler stopped' 
  });
});

/**
 * POST /api/sniper/poll
 * Manually trigger a scheduler poll (for testing)
 */
router.post('/poll', async (req, res) => {
  try {
    await scheduler.triggerPoll();
    const status = scheduler.getStatus();
    res.json({ 
      success: true, 
      message: 'Poll triggered',
      status,
      watched: scheduler.getWatchedItems()
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/sniper/watched
 * Get all currently watched items
 */
router.get('/watched', (req, res) => {
  const watched = scheduler.getWatchedItems();
  res.json({
    count: watched.length,
    items: watched
  });
});

/**
 * POST /api/sniper/test
 * Send a test Telegram notification
 */
router.post('/test', async (req, res) => {
  try {
    const result = await telegram.sendTest();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test notification sent to Telegram!' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/telegram/start
 * Start Telegram bot polling (listen for commands)
 */
router.post('/telegram/start', (req, res) => {
  telegram.startPolling();
  res.json({ 
    success: true, 
    message: 'Telegram bot polling started',
    status: telegram.getConfigStatus()
  });
});

/**
 * POST /api/sniper/telegram/stop
 * Stop Telegram bot polling
 */
router.post('/telegram/stop', (req, res) => {
  telegram.stopPolling();
  res.json({ 
    success: true, 
    message: 'Telegram bot polling stopped'
  });
});

/**
 * GET /api/sniper/telegram/status
 * Get Telegram configuration status
 */
router.get('/telegram/status', (req, res) => {
  res.json(telegram.getConfigStatus());
});

/**
 * POST /api/sniper/test-sms
 * Send a test SMS notification (legacy Twilio)
 */
router.post('/test-sms', async (req, res) => {
  try {
    const result = await notifications.sendTestNotification();
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test SMS sent successfully!' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/notify
 * Send a custom notification (for testing)
 */
router.post('/notify', async (req, res) => {
  const { type, restaurantName, city, details, price, dropTime } = req.body;

  if (!restaurantName) {
    return res.status(400).json({ 
      success: false, 
      error: 'restaurantName is required' 
    });
  }

  try {
    const result = await notifications.notify({
      type: type || 'ACQUIRED',
      restaurantName,
      city,
      details,
      price,
      dropTime
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// ACQUISITION BOT ENDPOINTS
// ============================================

/**
 * POST /api/sniper/bot/test
 * Test browser and proxy connection
 */
router.post('/bot/test', async (req, res) => {
  try {
    const result = await acquisitionBot.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/bot/acquire
 * Manually trigger an acquisition attempt
 */
router.post('/bot/acquire', async (req, res) => {
  const { restaurantName, bookingUrl, date, time, partySize, platform } = req.body;

  if (!restaurantName || !bookingUrl) {
    return res.status(400).json({ 
      success: false, 
      error: 'restaurantName and bookingUrl are required' 
    });
  }

  try {
    const result = await acquisitionBot.acquire({
      restaurantName,
      bookingUrl,
      date: date || new Date().toISOString().split('T')[0],
      time: time || '19:00',
      partySize: partySize || 2,
      platform
    });

    // Don't send screenshot in response (too large)
    const { screenshot, ...resultWithoutScreenshot } = result;

    res.json({
      ...resultWithoutScreenshot,
      hasScreenshot: !!screenshot
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/bot/launch
 * Launch the browser (pre-warm)
 */
router.post('/bot/launch', async (req, res) => {
  try {
    await acquisitionBot.launchBrowser();
    res.json({ 
      success: true, 
      message: 'Browser launched and ready' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/bot/close
 * Close the browser
 */
router.post('/bot/close', async (req, res) => {
  try {
    await acquisitionBot.closeBrowser();
    res.json({ 
      success: true, 
      message: 'Browser closed' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// VOICE AGENT ENDPOINTS
// ============================================

/**
 * GET /api/sniper/voice/status
 * Check voice agent configuration
 */
router.get('/voice/status', (req, res) => {
  res.json(voiceAgent.getConfigStatus());
});

/**
 * POST /api/sniper/voice/call
 * Initiate a voice call
 */
router.post('/voice/call', async (req, res) => {
  const { phoneNumber, restaurantName, objective, reservationDetails } = req.body;

  if (!phoneNumber || !restaurantName || !objective) {
    return res.status(400).json({ 
      success: false, 
      error: 'phoneNumber, restaurantName, and objective are required' 
    });
  }

  try {
    const result = await voiceAgent.initiateCall({
      phoneNumber,
      restaurantName,
      objective,
      reservationDetails
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/sniper/voice/call/:callId
 * Get call status and transcript
 */
router.get('/voice/call/:callId', async (req, res) => {
  const { callId } = req.params;

  try {
    const result = await voiceAgent.getCallStatus(callId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/voice/confirm
 * Quick action: Confirm a reservation
 */
router.post('/voice/confirm', async (req, res) => {
  const { phoneNumber, restaurantName, guestName, date, time, partySize, confirmationCode } = req.body;

  if (!phoneNumber || !restaurantName || !guestName) {
    return res.status(400).json({ 
      success: false, 
      error: 'phoneNumber, restaurantName, and guestName are required' 
    });
  }

  try {
    const result = await voiceAgent.confirmReservation(
      phoneNumber,
      restaurantName,
      guestName,
      date || new Date().toISOString().split('T')[0],
      time || '19:00',
      partySize || 2,
      confirmationCode
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/voice/transfer
 * Quick action: Request name transfer
 */
router.post('/voice/transfer', async (req, res) => {
  const { phoneNumber, restaurantName, originalName, newName, date, time, partySize, confirmationCode } = req.body;

  if (!phoneNumber || !restaurantName || !originalName || !newName) {
    return res.status(400).json({ 
      success: false, 
      error: 'phoneNumber, restaurantName, originalName, and newName are required' 
    });
  }

  try {
    const result = await voiceAgent.transferName(
      phoneNumber,
      restaurantName,
      originalName,
      newName,
      date || new Date().toISOString().split('T')[0],
      time || '19:00',
      partySize || 2,
      confirmationCode
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// RESY API ENDPOINTS (PRODUCTION-READY)
// ============================================

/**
 * GET /api/sniper/resy/status
 * Check Resy API configuration status
 */
router.get('/resy/status', (req, res) => {
  const config = resyClient.isConfigured();
  
  res.json({
    ...config,
    message: config.ready 
      ? '✅ Resy API fully configured and ready'
      : config.hasAuth
        ? '⚠️ Missing RESY_PAYMENT_ID in .env'
        : '❌ Missing RESY_AUTH_TOKEN in .env'
  });
});

/**
 * GET /api/sniper/resy/search
 * Search for a venue by name
 */
router.get('/resy/search', async (req, res) => {
  const { query, city } = req.query;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'query parameter is required' 
    });
  }

  try {
    const venues = await resyClient.searchVenue(query, city as string);
    res.json({ 
      success: true, 
      count: venues.length,
      venues 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/sniper/resy/slots
 * Find available slots at a venue
 */
router.get('/resy/slots', async (req, res) => {
  const { venueId, date, partySize } = req.query;

  if (!venueId || !date) {
    return res.status(400).json({ 
      success: false, 
      error: 'venueId and date are required' 
    });
  }

  try {
    const slots = await resyClient.findSlots(
      parseInt(venueId as string),
      date as string,
      parseInt(partySize as string) || 2
    );

    res.json({ 
      success: true, 
      count: slots.length,
      slots: slots.map(slot => ({
        config_id: slot.config_id,
        time: slot.time_slot || slot.date?.start,
        table_type: slot.table?.type || 'Standard',
        min_guests: slot.size?.min,
        max_guests: slot.size?.max,
        deposit: slot.payment?.deposit_fee,
        cancellation_fee: slot.payment?.cancellation_fee,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/resy/acquire
 * Full acquisition flow - find slot and book it
 * This is the PRODUCTION booking endpoint!
 */
router.post('/resy/acquire', async (req, res) => {
  const { venueId, date, partySize, preferredTime, timeFlexibility } = req.body;

  if (!venueId || !date) {
    return res.status(400).json({ 
      success: false, 
      error: 'venueId and date are required' 
    });
  }

  // Check configuration first
  const config = resyClient.isConfigured();
  if (!config.ready) {
    return res.status(400).json({
      success: false,
      error: config.hasAuth 
        ? 'RESY_PAYMENT_ID not configured in .env'
        : 'RESY_AUTH_TOKEN not configured in .env',
      configStatus: config
    });
  }

  try {
    const result = await resyClient.acquire({
      venueId: parseInt(venueId),
      date,
      partySize: parseInt(partySize) || 2,
      preferredTime,
      timeFlexibility: parseInt(timeFlexibility) || 60,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/sniper/resy/reservations
 * Get user's upcoming reservations (requires auth)
 */
router.get('/resy/reservations', async (req, res) => {
  try {
    const reservations = await resyClient.getUpcomingReservations();
    res.json({ 
      success: true, 
      count: reservations.length,
      reservations 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/sniper/resy/book-slot
 * Book a specific slot by config_id (for more control)
 */
router.post('/resy/book-slot', async (req, res) => {
  const { configId, date, partySize } = req.body;

  if (!configId || !date) {
    return res.status(400).json({ 
      success: false, 
      error: 'configId and date are required' 
    });
  }

  const config = resyClient.isConfigured();
  if (!config.ready) {
    return res.status(400).json({
      success: false,
      error: 'Resy credentials not configured',
      configStatus: config
    });
  }

  try {
    // Get booking token
    const bookToken = await resyClient.getBookingToken(
      configId,
      date,
      parseInt(partySize) || 2
    );

    // Make the reservation
    const result = await resyClient.makeReservation(bookToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ============================================
// MULTI-PLATFORM ENDPOINTS
// ============================================

/**
 * GET /api/sniper/platforms/status
 * Get status of ALL platform clients
 */
router.get('/platforms/status', (req, res) => {
  const status = acquisitionEngine.getClientsStatus();
  
  res.json({
    platforms: {
      resy: {
        ready: status.resy.ready,
        details: status.resy.details,
        required: ['RESY_AUTH_TOKEN', 'RESY_PAYMENT_ID'],
      },
      opentable: {
        ready: status.opentable.ready,
        details: status.opentable.details,
        required: ['OPENTABLE_CSRF_TOKEN', 'OPENTABLE_EMAIL', 'OPENTABLE_FIRST_NAME', 'OPENTABLE_LAST_NAME'],
      },
      sevenrooms: {
        ready: status.sevenrooms.ready,
        details: status.sevenrooms.details,
        required: ['User info (name, email) - shared with OpenTable'],
      },
      tock: {
        ready: status.tock.ready,
        details: status.tock.details,
        required: ['TOCK_AUTH_TOKEN', 'TOCK_EMAIL'],
      },
    },
    readyCount: Object.values(status).filter(s => s.ready).length - 1, // -1 for 'unknown'
    message: 'Configure platform credentials in .env file',
  });
});

/**
 * POST /api/sniper/acquire
 * Universal acquisition endpoint - works with any platform
 */
router.post('/acquire', async (req, res) => {
  const {
    platform,
    restaurantName,
    date,
    time,
    partySize,
    // Platform-specific IDs
    resyVenueId,
    openTableId,
    sevenRoomsSlug,
    tockSlug,
    // Options
    timeFlexibility,
    maxRetries,
    aggressiveMode,
  } = req.body;

  if (!platform || !restaurantName || !date) {
    return res.status(400).json({
      success: false,
      error: 'platform, restaurantName, and date are required',
    });
  }

  // Validate platform
  const validPlatforms: Platform[] = ['resy', 'opentable', 'sevenrooms', 'tock'];
  if (!validPlatforms.includes(platform)) {
    return res.status(400).json({
      success: false,
      error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}`,
    });
  }

  // Check platform configuration
  const status = acquisitionEngine.getClientsStatus();
  const platformStatus = status[platform as Platform];
  if (!platformStatus?.ready) {
    return res.status(400).json({
      success: false,
      error: `${platform} is not configured. Check your .env file.`,
      configStatus: platformStatus?.details,
    });
  }

  try {
    const result = await acquisitionEngine.acquire({
      platform: platform as Platform,
      restaurantName,
      date,
      time: time || '19:00',
      partySize: partySize || 2,
      resyVenueId,
      openTableId,
      sevenRoomsSlug,
      tockSlug,
      timeFlexibility: timeFlexibility || 60,
      maxRetries: maxRetries || 3,
      aggressiveMode: aggressiveMode || false,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sniper/scheduler/trigger/:itemId
 * Manually trigger acquisition for a specific portfolio item
 */
router.post('/scheduler/trigger/:itemId', async (req, res) => {
  const { itemId } = req.params;

  try {
    const result = await scheduler.triggerManualAcquisition(itemId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// OPENTABLE API ENDPOINTS
// ============================================

/**
 * GET /api/sniper/opentable/status
 * Check OpenTable API configuration
 */
router.get('/opentable/status', (req, res) => {
  const config = openTableClient.isConfigured();
  res.json({
    ...config,
    message: config.ready
      ? '✅ OpenTable API fully configured'
      : config.hasToken
        ? '⚠️ Missing user info (name, email) in .env'
        : '❌ Missing OPENTABLE_CSRF_TOKEN in .env',
  });
});

/**
 * GET /api/sniper/opentable/slots
 * Find available OpenTable slots
 */
router.get('/opentable/slots', async (req, res) => {
  const { restaurantId, date, time, partySize } = req.query;

  if (!restaurantId || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'restaurantId, date, and time are required',
    });
  }

  try {
    const slots = await openTableClient.findSlots(
      parseInt(restaurantId as string),
      date as string,
      time as string,
      parseInt(partySize as string) || 2
    );

    res.json({
      success: true,
      count: slots.length,
      slots,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sniper/opentable/acquire
 * Full OpenTable acquisition flow
 */
router.post('/opentable/acquire', async (req, res) => {
  const { restaurantId, date, time, partySize, timeFlexibility } = req.body;

  if (!restaurantId || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'restaurantId, date, and time are required',
    });
  }

  try {
    const result = await openTableClient.acquire({
      restaurantId: parseInt(restaurantId),
      date,
      time,
      partySize: partySize || 2,
      timeFlexibility: timeFlexibility || 60,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// SEVENROOMS API ENDPOINTS
// ============================================

/**
 * GET /api/sniper/sevenrooms/status
 */
router.get('/sevenrooms/status', (req, res) => {
  const config = sevenRoomsClient.isConfigured();
  res.json({
    ...config,
    message: config.ready
      ? '✅ SevenRooms API configured'
      : '⚠️ SevenRooms requires user info - shares config with OpenTable',
  });
});

/**
 * GET /api/sniper/sevenrooms/slots
 */
router.get('/sevenrooms/slots', async (req, res) => {
  const { venueSlug, date, time, partySize } = req.query;

  if (!venueSlug || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'venueSlug, date, and time are required',
    });
  }

  try {
    const slots = await sevenRoomsClient.findSlots(
      venueSlug as string,
      date as string,
      time as string,
      parseInt(partySize as string) || 2
    );

    res.json({
      success: true,
      count: slots.length,
      slots,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sniper/sevenrooms/acquire
 */
router.post('/sevenrooms/acquire', async (req, res) => {
  const { venueSlug, date, time, partySize, timeFlexibility } = req.body;

  if (!venueSlug || !date || !time) {
    return res.status(400).json({
      success: false,
      error: 'venueSlug, date, and time are required',
    });
  }

  try {
    const result = await sevenRoomsClient.acquire({
      venueSlug,
      date,
      time,
      partySize: partySize || 2,
      timeFlexibility: timeFlexibility || 60,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================
// TOCK API ENDPOINTS
// ============================================

/**
 * GET /api/sniper/tock/status
 */
router.get('/tock/status', (req, res) => {
  const config = tockClient.isConfigured();
  res.json({
    ...config,
    message: config.ready
      ? '✅ Tock API configured'
      : '❌ Missing TOCK_AUTH_TOKEN in .env',
  });
});

/**
 * GET /api/sniper/tock/slots
 */
router.get('/tock/slots', async (req, res) => {
  const { venueSlug, date, partySize } = req.query;

  if (!venueSlug || !date) {
    return res.status(400).json({
      success: false,
      error: 'venueSlug and date are required',
    });
  }

  try {
    const slots = await tockClient.findSlots(
      venueSlug as string,
      date as string,
      parseInt(partySize as string) || 2
    );

    res.json({
      success: true,
      count: slots.length,
      slots,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sniper/tock/acquire
 */
router.post('/tock/acquire', async (req, res) => {
  const { venueSlug, date, time, partySize, experienceId } = req.body;

  if (!venueSlug || !date) {
    return res.status(400).json({
      success: false,
      error: 'venueSlug and date are required',
    });
  }

  try {
    const result = await tockClient.acquire({
      venueSlug,
      date,
      time,
      partySize: partySize || 2,
      experienceId,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

