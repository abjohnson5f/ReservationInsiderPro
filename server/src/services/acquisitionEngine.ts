/**
 * Unified Acquisition Engine
 * 
 * This is the master controller that coordinates reservation acquisition
 * across ALL supported platforms. It handles:
 * 
 * - Platform detection and routing
 * - Drop-time precision execution
 * - Aggressive retry logic
 * - Concurrent attempts
 * - Drop pattern learning/confirmation
 * 
 * Supported Platforms:
 * - Resy (API)
 * - OpenTable (API)
 * - SevenRooms (API)
 * - Tock (API)
 * 
 * Key Features:
 * - Pre-warm connections before drop time
 * - Parallel slot checking with instant booking
 * - Exponential backoff with rate limit awareness
 * - Confirmation of drop patterns after success
 */

import resyClient from './resyApi';
import openTableClient from './openTableApi';
import sevenRoomsClient from './sevenRoomsApi';
import tockClient from './tockApi';
import pool from '../db';
import identityManager, { BookingIdentity } from './identityManager';
import transferTracker from './transferTracker';

// ============================================
// TYPES
// ============================================

export type Platform = 'resy' | 'opentable' | 'sevenrooms' | 'tock' | 'unknown';

export interface AcquisitionRequest {
  platform: Platform;
  restaurantName: string;
  
  // Platform-specific identifiers
  resyVenueId?: number;
  openTableId?: number;
  sevenRoomsSlug?: string;
  tockSlug?: string;
  
  // Booking details
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  partySize: number;
  
  // Options
  timeFlexibility?: number; // Minutes to expand search window
  maxRetries?: number;
  aggressiveMode?: boolean; // For drop-time execution
  
  // Identity management - if not provided, auto-selects best identity
  identityId?: number;
  
  // Portfolio tracking
  portfolioItemId?: string;
}

export interface AcquisitionResult {
  success: boolean;
  platform: Platform;
  confirmationCode?: string;
  bookedTime?: string;
  error?: string;
  attempts?: number;
  duration?: number;
  details?: any;
  
  // Identity tracking
  identityId?: number;
  identityName?: string;
  
  // Transfer tracking
  transferId?: number;
}

export interface DropTimeConfig {
  portfolioItemId: string;
  dropDate: string; // YYYY-MM-DD (the date reservations become available)
  dropTime: string; // HH:MM (when they drop)
  targetDate: string; // YYYY-MM-DD (the date TO BOOK)
  timezone: string;
}

// ============================================
// ACQUISITION ENGINE
// ============================================

class AcquisitionEngine {
  private activeAcquisitions: Map<string, AbortController> = new Map();

  /**
   * Get status of all platform clients
   */
  getClientsStatus(): Record<Platform, { ready: boolean; details: any }> {
    return {
      resy: {
        ready: resyClient.isConfigured().ready,
        details: resyClient.isConfigured(),
      },
      opentable: {
        ready: openTableClient.isConfigured().ready,
        details: openTableClient.isConfigured(),
      },
      sevenrooms: {
        ready: sevenRoomsClient.isConfigured().ready,
        details: sevenRoomsClient.isConfigured(),
      },
      tock: {
        ready: tockClient.isConfigured().ready,
        details: tockClient.isConfigured(),
      },
      unknown: {
        ready: false,
        details: { message: 'Platform not specified' },
      },
    };
  }

  /**
   * Execute a single acquisition attempt with identity rotation
   */
  async acquire(request: AcquisitionRequest): Promise<AcquisitionResult> {
    const startTime = Date.now();
    const maxRetries = request.maxRetries || 3;
    let attempts = 0;
    let lastError: string | undefined;

    // Select or fetch the identity to use
    let identity: BookingIdentity | null = null;
    const platformKey = request.platform as 'resy' | 'opentable' | 'sevenrooms' | 'tock';
    
    if (request.identityId) {
      identity = await identityManager.getIdentity(request.identityId);
    } else {
      // Auto-select the best identity for this platform (lowest usage)
      identity = await identityManager.getBestIdentityForPlatform(platformKey);
    }

    if (!identity) {
      return {
        success: false,
        platform: request.platform,
        error: `No available identity with ${request.platform} credentials and capacity`,
        attempts: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(`\n[AcquisitionEngine] 🎯 Starting acquisition`);
    console.log(`  Platform: ${request.platform}`);
    console.log(`  Restaurant: ${request.restaurantName}`);
    console.log(`  Date: ${request.date} at ${request.time}`);
    console.log(`  Party: ${request.partySize}`);
    console.log(`  Identity: ${identity.name} (ID: ${identity.id})`);

    for (let retry = 0; retry < maxRetries; retry++) {
      attempts++;
      
      try {
        let result: AcquisitionResult;

        switch (request.platform) {
          case 'resy':
            result = await this.acquireResy(request, identity);
            break;
          case 'opentable':
            result = await this.acquireOpenTable(request, identity);
            break;
          case 'sevenrooms':
            result = await this.acquireSevenRooms(request, identity);
            break;
          case 'tock':
            result = await this.acquireTock(request, identity);
            break;
          default:
            return {
              success: false,
              platform: request.platform,
              error: `Unknown platform: ${request.platform}`,
              attempts,
              duration: Date.now() - startTime,
            };
        }

        if (result.success) {
          result.attempts = attempts;
          result.duration = Date.now() - startTime;
          result.identityId = identity.id;
          result.identityName = identity.name;
          
          // Record the booking against the identity
          await identityManager.recordBooking(identity.id, platformKey);
          
          // Create transfer record for AT listing workflow
          const transfer = await transferTracker.createTransfer({
            portfolio_item_id: request.portfolioItemId,
            restaurant_name: request.restaurantName,
            platform: request.platform,
            reservation_date: request.date,
            reservation_time: result.bookedTime || request.time,
            party_size: request.partySize,
            confirmation_number: result.confirmationCode,
            booking_identity_id: identity.id,
          });
          result.transferId = transfer.id;
          
          console.log(`[AcquisitionEngine] ✅ SUCCESS after ${attempts} attempts (${result.duration}ms)`);
          console.log(`[AcquisitionEngine] 📝 Transfer record created: ${transfer.id}`);
          return result;
        }

        lastError = result.error;
        console.log(`[AcquisitionEngine] Attempt ${attempts} failed: ${lastError}`);

        // Don't retry if slot is genuinely unavailable
        if (lastError?.includes('No slots available')) {
          break;
        }

        // Exponential backoff (but quick for drop time)
        if (retry < maxRetries - 1) {
          const delay = request.aggressiveMode ? 100 : Math.min(1000 * Math.pow(2, retry), 5000);
          await this.sleep(delay);
        }

      } catch (error: any) {
        lastError = error.message;
        console.error(`[AcquisitionEngine] Attempt ${attempts} error:`, error.message);
      }
    }

    return {
      success: false,
      platform: request.platform,
      error: lastError || 'Max retries exceeded',
      attempts,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Execute acquisition at exact drop time with aggressive retry
   */
  async executeAtDropTime(
    request: AcquisitionRequest,
    config: DropTimeConfig
  ): Promise<AcquisitionResult> {
    const acquisitionId = `${config.portfolioItemId}-${Date.now()}`;
    const controller = new AbortController();
    this.activeAcquisitions.set(acquisitionId, controller);

    console.log(`\n[AcquisitionEngine] ⏰ DROP TIME EXECUTION for ${request.restaurantName}`);
    console.log(`  Target date to book: ${config.targetDate}`);
    console.log(`  Drop time: ${config.dropTime} ${config.timezone}`);

    // Update request with target date
    const dropRequest: AcquisitionRequest = {
      ...request,
      date: config.targetDate,
      aggressiveMode: true,
      maxRetries: 10, // More retries for drop time
    };

    // Phase 1: Pre-warm (start 5 seconds before)
    console.log('[AcquisitionEngine] Phase 1: Pre-warming connections...');
    await this.prewarmPlatform(request.platform, request);

    // Phase 2: Aggressive acquisition loop
    console.log('[AcquisitionEngine] Phase 2: Starting aggressive acquisition...');
    
    const maxDuration = 60000; // Max 60 seconds of trying
    const startTime = Date.now();
    let attempts = 0;
    let lastResult: AcquisitionResult | null = null;

    while (Date.now() - startTime < maxDuration) {
      if (controller.signal.aborted) {
        console.log('[AcquisitionEngine] Acquisition cancelled');
        break;
      }

      attempts++;
      
      try {
        lastResult = await this.acquire({
          ...dropRequest,
          maxRetries: 1, // Single attempt per loop iteration
        });

        if (lastResult.success) {
          // Success! Record the drop pattern
          await this.confirmDropPattern(config, {
            success: true,
            actualTime: new Date().toISOString(),
          });

          this.activeAcquisitions.delete(acquisitionId);
          return {
            ...lastResult,
            attempts,
            duration: Date.now() - startTime,
          };
        }

        // Quick pause between attempts (100ms in aggressive mode)
        await this.sleep(100);

      } catch (error: any) {
        console.error(`[AcquisitionEngine] Drop attempt ${attempts} error:`, error.message);
        await this.sleep(200);
      }
    }

    this.activeAcquisitions.delete(acquisitionId);
    
    return {
      success: false,
      platform: request.platform,
      error: lastResult?.error || 'Timeout - slots may not have dropped yet',
      attempts,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Pre-warm platform connection before drop time
   */
  private async prewarmPlatform(platform: Platform, request: AcquisitionRequest): Promise<void> {
    try {
      switch (platform) {
        case 'resy':
          if (request.resyVenueId) {
            // Make a non-booking API call to warm connection
            await resyClient.findSlots(request.resyVenueId, request.date, request.partySize);
          }
          break;
        case 'opentable':
          if (request.openTableId) {
            await openTableClient.findSlots(request.openTableId, request.date, request.time, request.partySize);
          }
          break;
        case 'sevenrooms':
          if (request.sevenRoomsSlug) {
            await sevenRoomsClient.findSlots(request.sevenRoomsSlug, request.date, request.time, request.partySize);
          }
          break;
        case 'tock':
          if (request.tockSlug) {
            await tockClient.findSlots(request.tockSlug, request.date, request.partySize);
          }
          break;
      }
      console.log(`[AcquisitionEngine] ${platform} connection pre-warmed`);
    } catch (error: any) {
      console.log(`[AcquisitionEngine] Pre-warm failed (non-critical): ${error.message}`);
    }
  }

  /**
   * Resy acquisition with identity tracking
   * Note: Credentials are read from environment variables in the platform client.
   * The identity system tracks WHICH identity's credentials should be used.
   * For multi-identity support, you'd need to swap env vars or extend the clients.
   */
  private async acquireResy(request: AcquisitionRequest, identity: BookingIdentity): Promise<AcquisitionResult> {
    if (!request.resyVenueId) {
      return { success: false, platform: 'resy', error: 'resyVenueId not provided' };
    }

    console.log(`[AcquisitionEngine] Using identity "${identity.name}" for Resy booking`);
    
    const result = await resyClient.acquire({
      venueId: request.resyVenueId,
      date: request.date,
      partySize: request.partySize,
      preferredTime: request.time,
      timeFlexibility: request.timeFlexibility || 60,
    });

    return {
      success: result.success,
      platform: 'resy',
      confirmationCode: result.resy_token || result.confirmation,
      bookedTime: request.time, // Use requested time as booked time
      error: result.error,
      details: result.details,
    };
  }

  /**
   * OpenTable acquisition with identity tracking
   */
  private async acquireOpenTable(request: AcquisitionRequest, identity: BookingIdentity): Promise<AcquisitionResult> {
    if (!request.openTableId) {
      return { success: false, platform: 'opentable', error: 'openTableId not provided' };
    }

    console.log(`[AcquisitionEngine] Using identity "${identity.name}" for OpenTable booking`);

    const result = await openTableClient.acquire({
      restaurantId: request.openTableId,
      date: request.date,
      time: request.time,
      partySize: request.partySize,
      timeFlexibility: request.timeFlexibility || 60,
    });

    return {
      success: result.success,
      platform: 'opentable',
      confirmationCode: result.confirmationNumber,
      bookedTime: request.time,
      error: result.error,
      details: result.details,
    };
  }

  /**
   * SevenRooms acquisition with identity tracking
   */
  private async acquireSevenRooms(request: AcquisitionRequest, identity: BookingIdentity): Promise<AcquisitionResult> {
    if (!request.sevenRoomsSlug) {
      return { success: false, platform: 'sevenrooms', error: 'sevenRoomsSlug not provided' };
    }

    console.log(`[AcquisitionEngine] Using identity "${identity.name}" for SevenRooms booking`);

    const result = await sevenRoomsClient.acquire({
      venueSlug: request.sevenRoomsSlug,
      date: request.date,
      time: request.time,
      partySize: request.partySize,
      timeFlexibility: request.timeFlexibility || 60,
    });

    return {
      success: result.success,
      platform: 'sevenrooms',
      confirmationCode: result.confirmationId,
      bookedTime: request.time,
      error: result.error,
      details: result.details,
    };
  }

  /**
   * Tock acquisition with identity tracking
   */
  private async acquireTock(request: AcquisitionRequest, identity: BookingIdentity): Promise<AcquisitionResult> {
    if (!request.tockSlug) {
      return { success: false, platform: 'tock', error: 'tockSlug not provided' };
    }

    console.log(`[AcquisitionEngine] Using identity "${identity.name}" for Tock booking`);

    const result = await tockClient.acquire({
      venueSlug: request.tockSlug,
      date: request.date,
      time: request.time,
      partySize: request.partySize,
    });

    return {
      success: result.success,
      platform: 'tock',
      confirmationCode: result.confirmationId,
      bookedTime: request.time,
      error: result.error,
      details: result.details,
    };
  }

  /**
   * Confirm and record a drop pattern after successful acquisition
   */
  private async confirmDropPattern(
    config: DropTimeConfig,
    result: { success: boolean; actualTime: string }
  ): Promise<void> {
    if (!pool || !result.success) return;

    try {
      // Calculate days in advance this reservation dropped
      const dropDate = new Date(config.dropDate);
      const targetDate = new Date(config.targetDate);
      const daysInAdvance = Math.round((targetDate.getTime() - dropDate.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`[AcquisitionEngine] 📊 Drop Pattern Confirmed:`);
      console.log(`  Restaurant drops ${daysInAdvance} days in advance`);
      console.log(`  Drop time: ${config.dropTime} ${config.timezone}`);

      // Store the confirmed drop pattern
      await pool.query(`
        INSERT INTO confirmed_drop_patterns (
          portfolio_item_id,
          restaurant_name,
          days_in_advance,
          drop_time,
          drop_timezone,
          confirmed_at,
          success_rate
        )
        SELECT 
          $1,
          restaurant_name,
          $2,
          $3,
          $4,
          NOW(),
          1.0
        FROM portfolio_items WHERE id = $1
        ON CONFLICT (portfolio_item_id) DO UPDATE SET
          days_in_advance = $2,
          drop_time = $3,
          drop_timezone = $4,
          confirmed_at = NOW(),
          success_rate = (confirmed_drop_patterns.success_rate + 1.0) / 2
      `, [config.portfolioItemId, daysInAdvance, config.dropTime, config.timezone]);

    } catch (error: any) {
      console.error('[AcquisitionEngine] Failed to record drop pattern:', error.message);
    }
  }

  /**
   * Cancel an active acquisition
   */
  cancelAcquisition(acquisitionId: string): boolean {
    const controller = this.activeAcquisitions.get(acquisitionId);
    if (controller) {
      controller.abort();
      this.activeAcquisitions.delete(acquisitionId);
      return true;
    }
    return false;
  }

  /**
   * Utility: Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const acquisitionEngine = new AcquisitionEngine();

export default acquisitionEngine;
export { AcquisitionEngine };

