/**
 * Enhanced Sniper Scheduler
 * 
 * The brain of the automation system. Monitors portfolio items
 * marked for tracking and triggers actions at the RIGHT time.
 * 
 * Key Features:
 * - Polls database for items with status='WATCHING'
 * - Calculates time until next drop
 * - Sends T-5min and T-1min warnings
 * - EXECUTES at exact drop time with aggressive retry
 * - Uses multi-platform acquisition engine
 * - Records successful drop patterns for future reference
 * 
 * How Drop Times Work:
 * - next_drop_date: The DATE when reservations become available
 * - next_drop_time: The TIME (HH:MM) when they drop
 * - target_date: The RESERVATION DATE we want to book
 * 
 * Example:
 * - Want to dine at Carbone on Jan 15th
 * - Carbone releases tables 21 days in advance at 10:00 AM ET
 * - Set: target_date=2025-01-15, next_drop_date=2024-12-25, next_drop_time=10:00
 */

import pool from '../db';
import * as telegram from './telegram';
import acquisitionEngine from '../services/acquisitionEngine';
import type { Platform, AcquisitionRequest } from '../services/acquisitionEngine';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// TYPES
// ============================================

interface WatchedItem {
  id: string;
  restaurant_name: string;
  platform: string;
  next_drop_date: string;      // YYYY-MM-DD (when reservations drop)
  next_drop_time: string;      // HH:MM
  drop_timezone: string;       // e.g., 'America/New_York'
  target_date?: string;        // YYYY-MM-DD (date to book)
  time?: string;               // Preferred time
  guests?: number;             // Party size
  status: string;
  
  // Platform-specific IDs
  resy_venue_id?: number;
  opentable_id?: number;
  sevenrooms_slug?: string;
  tock_slug?: string;
}

interface ScheduledAction {
  itemId: string;
  restaurantName: string;
  platform: Platform;
  dropTime: Date;
  targetDate: string;
  preferredTime: string;
  partySize: number;
  
  // Platform IDs
  resyVenueId?: number;
  openTableId?: number;
  sevenRoomsSlug?: string;
  tockSlug?: string;
  
  // Status flags
  prewarmSent: boolean;
  warningFiveSent: boolean;
  warningOneSent: boolean;
  executed: boolean;
  executionStarted: Date | null;
}

// ============================================
// STATE
// ============================================

let isRunning = false;
let pollInterval: NodeJS.Timeout | null = null;
const scheduledActions: Map<string, ScheduledAction> = new Map();

// Polling frequency
const POLL_INTERVAL_MS = 15 * 1000; // Check every 15 seconds (more aggressive)

// Warning thresholds (in milliseconds)
const PREWARM_TIME = 10 * 1000;     // 10 seconds before drop
const WARNING_5_MIN = 5 * 60 * 1000;
const WARNING_1_MIN = 1 * 60 * 1000;
const EXECUTION_WINDOW = 2000;      // 2 second window for execution

// ============================================
// TIMEZONE HANDLING
// ============================================

const timezoneOffsets: Record<string, number> = {
  'America/Los_Angeles': -8,
  'America/New_York': -5,
  'America/Chicago': -6,
  'America/Denver': -7,
  'America/Phoenix': -7,
  'Europe/London': 0,
  'Europe/Paris': 1,
  'Asia/Tokyo': 9,
  'Asia/Hong_Kong': 8,
  'Australia/Sydney': 11
};

/**
 * Convert a date/time string in a specific timezone to a JS Date object
 */
const parseDropTime = (date: string, time: string, timezone: string): Date => {
  const dateTimeString = `${date}T${time}:00`;
  const target = new Date(dateTimeString);
  
  // Handle DST-aware conversion
  const offset = timezoneOffsets[timezone] || 0;
  const localOffset = -new Date().getTimezoneOffset() / 60;
  const hoursDiff = offset - localOffset;
  
  target.setHours(target.getHours() - hoursDiff);
  return target;
};

// ============================================
// DATABASE QUERIES
// ============================================

/**
 * Fetch all items marked for watching
 */
const fetchWatchedItems = async (): Promise<WatchedItem[]> => {
  if (!pool) {
    console.warn('[Scheduler] Database not connected');
    return [];
  }

  try {
    const result = await pool.query(`
      SELECT 
        id,
        restaurant_name,
        platform,
        next_drop_date,
        next_drop_time,
        drop_timezone,
        target_date,
        time,
        guests,
        status,
        resy_venue_id,
        opentable_id,
        sevenrooms_slug,
        tock_slug
      FROM portfolio_items
      WHERE status = 'WATCHING'
        AND next_drop_date IS NOT NULL
        AND next_drop_time IS NOT NULL
      ORDER BY next_drop_date ASC, next_drop_time ASC
    `);
    
    return result.rows.map(row => ({
      ...row,
      drop_timezone: row.drop_timezone || 'America/New_York',
    }));
  } catch (error: any) {
    console.error('[Scheduler] Failed to fetch watched items:', error.message);
    return [];
  }
};

/**
 * Update item status after acquisition attempt
 */
const updateItemStatus = async (id: string, status: string, confirmationCode?: string): Promise<void> => {
  if (!pool) return;

  try {
    const updateFields = ['status = $1', 'updated_at = NOW()'];
    const params: any[] = [status, id];
    
    if (confirmationCode) {
      updateFields.push(`notes = COALESCE(notes, '') || ' Confirmation: ' || $${params.length + 1}`);
      params.splice(params.length - 1, 0, confirmationCode);
    }

    await pool.query(
      `UPDATE portfolio_items SET ${updateFields.join(', ')} WHERE id = $${params.length}`,
      params
    );
    console.log(`[Scheduler] Updated ${id} status to ${status}`);
  } catch (error: any) {
    console.error('[Scheduler] Failed to update status:', error.message);
  }
};

/**
 * Log acquisition attempt
 */
const logAcquisitionAttempt = async (
  item: WatchedItem,
  result: any,
  duration: number,
  triggerType: string
): Promise<void> => {
  if (!pool) return;

  try {
    await pool.query(`
      INSERT INTO acquisition_log (
        portfolio_item_id, restaurant_name, platform,
        duration_ms, attempts, success, confirmation_code, error_message,
        target_date, target_time, party_size, trigger_type, response_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      item.id,
      item.restaurant_name,
      item.platform,
      duration,
      result.attempts || 1,
      result.success,
      result.confirmationCode || null,
      result.error || null,
      item.target_date || item.next_drop_date,
      item.time || '19:00',
      item.guests || 2,
      triggerType,
      JSON.stringify(result.details || {}),
    ]);
  } catch (error: any) {
    console.error('[Scheduler] Failed to log acquisition:', error.message);
  }
};

// ============================================
// CORE SCHEDULER LOGIC
// ============================================

/**
 * Detect platform from string
 */
const detectPlatform = (platformStr: string): Platform => {
  const lower = platformStr?.toLowerCase() || '';
  if (lower.includes('resy')) return 'resy';
  if (lower.includes('opentable')) return 'opentable';
  if (lower.includes('sevenrooms') || lower.includes('seven')) return 'sevenrooms';
  if (lower.includes('tock')) return 'tock';
  return 'unknown';
};

/**
 * Process a single watched item
 */
const processItem = async (item: WatchedItem): Promise<void> => {
  const dropTime = parseDropTime(
    item.next_drop_date,
    item.next_drop_time,
    item.drop_timezone || 'America/New_York'
  );

  const now = new Date();
  const timeUntilDrop = dropTime.getTime() - now.getTime();

  // Skip if drop time has passed by more than 2 minutes
  if (timeUntilDrop < -120000) {
    console.log(`[Scheduler] ${item.restaurant_name} drop time passed, removing from watch`);
    scheduledActions.delete(item.id);
    return;
  }

  // Get or create scheduled action
  let action = scheduledActions.get(item.id);
  const platform = detectPlatform(item.platform);
  
  if (!action) {
    action = {
      itemId: item.id,
      restaurantName: item.restaurant_name,
      platform,
      dropTime,
      targetDate: item.target_date || item.next_drop_date,
      preferredTime: item.time || '19:00',
      partySize: item.guests || 2,
      resyVenueId: item.resy_venue_id,
      openTableId: item.opentable_id,
      sevenRoomsSlug: item.sevenrooms_slug,
      tockSlug: item.tock_slug,
      prewarmSent: false,
      warningFiveSent: false,
      warningOneSent: false,
      executed: false,
      executionStarted: null,
    };
    scheduledActions.set(item.id, action);
    
    const minutesUntil = Math.round(timeUntilDrop / 60000);
    console.log(`[Scheduler] 👁️ Now watching: ${item.restaurant_name}`);
    console.log(`   Platform: ${platform}`);
    console.log(`   Target date: ${action.targetDate}`);
    console.log(`   Drop time: ${item.next_drop_time} ${item.drop_timezone}`);
    console.log(`   Time until drop: ${minutesUntil} minutes`);
  }

  // T-5 minute warning
  if (!action.warningFiveSent && timeUntilDrop <= WARNING_5_MIN && timeUntilDrop > WARNING_1_MIN) {
    console.log(`[Scheduler] 🎯 ${item.restaurant_name} - T-5 MINUTES`);
    await telegram.notifyDropWarning(
      item.restaurant_name,
      `${item.next_drop_time} ${item.drop_timezone}`,
      '', // city
      item.id
    );
    action.warningFiveSent = true;
  }

  // T-1 minute warning
  if (!action.warningOneSent && timeUntilDrop <= WARNING_1_MIN && timeUntilDrop > PREWARM_TIME) {
    console.log(`[Scheduler] ⚡ ${item.restaurant_name} - T-1 MINUTE`);
    await telegram.notifyDropImminent(item.restaurant_name, item.id);
    action.warningOneSent = true;
  }

  // T-10 seconds: Start acquisition engine
  if (!action.executed && timeUntilDrop <= PREWARM_TIME && timeUntilDrop >= -EXECUTION_WINDOW) {
    if (!action.executionStarted) {
      action.executionStarted = new Date();
      console.log(`\n[Scheduler] 🚀🚀🚀 ${item.restaurant_name} - DROP TIME EXECUTION STARTING!`);
      
      // Execute the acquisition engine
      executeDropTimeAcquisition(item, action).catch(err => {
        console.error('[Scheduler] Drop time execution failed:', err);
      });
    }
  }

  // Mark as executed after 2 minute window (cleanup)
  if (!action.executed && timeUntilDrop < -120000) {
    action.executed = true;
    scheduledActions.delete(item.id);
  }
};

/**
 * Execute acquisition at drop time
 */
const executeDropTimeAcquisition = async (item: WatchedItem, action: ScheduledAction): Promise<void> => {
  action.executed = true;
  const startTime = Date.now();

  // Build acquisition request
  const request: AcquisitionRequest = {
    platform: action.platform,
    restaurantName: action.restaurantName,
    date: action.targetDate,
    time: action.preferredTime,
    partySize: action.partySize,
    resyVenueId: action.resyVenueId,
    openTableId: action.openTableId,
    sevenRoomsSlug: action.sevenRoomsSlug,
    tockSlug: action.tockSlug,
    aggressiveMode: true,
    maxRetries: 15,
    timeFlexibility: 90,
  };

  try {
    // Execute with acquisition engine
    const result = await acquisitionEngine.executeAtDropTime(request, {
      portfolioItemId: item.id,
      dropDate: item.next_drop_date,
      dropTime: item.next_drop_time,
      targetDate: action.targetDate,
      timezone: item.drop_timezone,
    });

    const duration = Date.now() - startTime;

    // Log the attempt
    await logAcquisitionAttempt(item, result, duration, 'drop_time');

    if (result.success) {
      console.log(`[Scheduler] ✅ ${item.restaurant_name} - ACQUIRED!`);
      console.log(`   Confirmation: ${result.confirmationCode}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Attempts: ${result.attempts}`);

      await telegram.notifyAcquired(
        item.restaurant_name,
        0, // cost
        `✅ Auto-acquired!\nConfirmation: ${result.confirmationCode || 'Check platform'}\nTime: ${result.bookedTime || action.preferredTime}`,
        item.id
      );
      await updateItemStatus(item.id, 'ACQUIRED', result.confirmationCode);
    } else {
      console.log(`[Scheduler] ❌ ${item.restaurant_name} - ACQUISITION FAILED`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Attempts: ${result.attempts}`);

      await telegram.notifyAcquired(
        item.restaurant_name,
        0,
        `⚠️ Acquisition failed after ${result.attempts} attempts.\nError: ${result.error}\nManual intervention may be needed.`,
        item.id
      );
      
      // Keep watching for retry (drop might have been delayed)
      await updateItemStatus(item.id, 'PENDING_CONFIRMATION');
    }
  } catch (error: any) {
    console.error(`[Scheduler] 💥 ${item.restaurant_name} - EXECUTION ERROR:`, error.message);
    await telegram.notifyError(item.restaurant_name, error.message);
    await updateItemStatus(item.id, 'WATCHING'); // Keep watching for retry
  } finally {
    scheduledActions.delete(item.id);
  }
};

/**
 * Main polling loop
 */
const poll = async (): Promise<void> => {
  if (!isRunning) return;

  try {
    const watchedItems = await fetchWatchedItems();
    
    // Process each watched item
    for (const item of watchedItems) {
      await processItem(item);
    }

    // Clean up expired actions (older than 5 minutes past drop time)
    const now = new Date();
    for (const [id, action] of scheduledActions) {
      if (action.dropTime.getTime() < now.getTime() - 300000) {
        console.log(`[Scheduler] Cleaning up expired action: ${action.restaurantName}`);
        scheduledActions.delete(id);
      }
    }

  } catch (error: any) {
    console.error('[Scheduler] Poll error:', error.message);
  }
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Start the scheduler
 */
export const start = (): void => {
  if (isRunning) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log('[Scheduler] 🟢 Starting enhanced scheduler...');
  console.log('[Scheduler] Platform clients status:');
  
  const status = acquisitionEngine.getClientsStatus();
  for (const [platform, info] of Object.entries(status)) {
    if (platform !== 'unknown') {
      console.log(`  ${platform}: ${info.ready ? '✅ Ready' : '⚠️ Not configured'}`);
    }
  }
  
  isRunning = true;
  
  // Initial poll
  poll();
  
  // Set up recurring poll
  pollInterval = setInterval(poll, POLL_INTERVAL_MS);
  
  console.log(`[Scheduler] Polling every ${POLL_INTERVAL_MS / 1000} seconds`);
};

/**
 * Stop the scheduler
 */
export const stop = (): void => {
  if (!isRunning) {
    console.log('[Scheduler] Not running');
    return;
  }

  console.log('[Scheduler] 🔴 Stopping scheduler...');
  isRunning = false;
  
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  scheduledActions.clear();
};

/**
 * Get current scheduler status
 */
export const getStatus = (): {
  isRunning: boolean;
  watchedCount: number;
  nextDrop: { restaurant: string; time: Date; platform: string } | null;
  platformsReady: Record<string, boolean>;
} => {
  let nextDrop: { restaurant: string; time: Date; platform: string } | null = null;
  
  for (const action of scheduledActions.values()) {
    if (!action.executed && (!nextDrop || action.dropTime < nextDrop.time)) {
      nextDrop = { 
        restaurant: action.restaurantName, 
        time: action.dropTime,
        platform: action.platform,
      };
    }
  }

  const clientStatus = acquisitionEngine.getClientsStatus();

  return {
    isRunning,
    watchedCount: scheduledActions.size,
    nextDrop,
    platformsReady: {
      resy: clientStatus.resy.ready,
      opentable: clientStatus.opentable.ready,
      sevenrooms: clientStatus.sevenrooms.ready,
      tock: clientStatus.tock.ready,
    },
  };
};

/**
 * Manually trigger a check (for testing)
 */
export const triggerPoll = async (): Promise<void> => {
  await poll();
};

/**
 * Get all currently watched items
 */
export const getWatchedItems = (): ScheduledAction[] => {
  return Array.from(scheduledActions.values());
};

/**
 * Manually trigger acquisition for an item (for testing)
 */
export const triggerManualAcquisition = async (itemId: string): Promise<any> => {
  const items = await fetchWatchedItems();
  const item = items.find(i => i.id === itemId);
  
  if (!item) {
    return { success: false, error: 'Item not found or not in WATCHING status' };
  }

  const platform = detectPlatform(item.platform);
  const request: AcquisitionRequest = {
    platform,
    restaurantName: item.restaurant_name,
    date: item.target_date || item.next_drop_date,
    time: item.time || '19:00',
    partySize: item.guests || 2,
    resyVenueId: item.resy_venue_id,
    openTableId: item.opentable_id,
    sevenRoomsSlug: item.sevenrooms_slug,
    tockSlug: item.tock_slug,
    maxRetries: 5,
    timeFlexibility: 90,
  };

  const startTime = Date.now();
  const result = await acquisitionEngine.acquire(request);
  const duration = Date.now() - startTime;

  await logAcquisitionAttempt(item, result, duration, 'manual');

  if (result.success) {
    await updateItemStatus(item.id, 'ACQUIRED', result.confirmationCode);
  }

  return result;
};

export default {
  start,
  stop,
  getStatus,
  triggerPoll,
  getWatchedItems,
  triggerManualAcquisition,
};
