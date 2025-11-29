/**
 * OpenTable API Client - PRODUCTION IMPLEMENTATION
 * 
 * Uses OpenTable's actual GraphQL API (same as their website).
 * Based on: https://jonluca.substack.com/p/opentable
 * 
 * API Endpoints:
 * - POST /dapi/fe/gql - GraphQL for availability
 * - POST /dapi/booking/make-reservation - Book a slot
 * 
 * Required Environment Variables:
 * - OPENTABLE_CSRF_TOKEN: Your CSRF token (from browser after logging in)
 * - OPENTABLE_FIRST_NAME: Your first name
 * - OPENTABLE_LAST_NAME: Your last name
 * - OPENTABLE_EMAIL: Your email
 * - OPENTABLE_PHONE: Your phone number
 * 
 * How to get your CSRF token:
 * 1. Go to opentable.com and log in
 * 2. Open Chrome DevTools → Network tab
 * 3. Find any request to opentable.com
 * 4. Copy the 'x-csrf-token' header value
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const OPENTABLE_BASE_URL = 'https://www.opentable.com/dapi';

// User credentials from environment
const CSRF_TOKEN = process.env.OPENTABLE_CSRF_TOKEN || '';
const FIRST_NAME = process.env.OPENTABLE_FIRST_NAME || '';
const LAST_NAME = process.env.OPENTABLE_LAST_NAME || '';
const EMAIL = process.env.OPENTABLE_EMAIL || '';
const PHONE = process.env.OPENTABLE_PHONE || '';

// ============================================
// TYPES
// ============================================

export interface OpenTableSlot {
  dateTime: string;
  isAvailable: boolean;
  timeOffsetMinutes: number;
  slotAvailabilityToken: string;
  slotHash: string;
  attributes?: string[];
}

export interface OpenTableSearchResult {
  name: string;
  rid: number;
  city: string;
  neighborhood?: string;
  cuisine?: string;
  priceRange?: number;
}

export interface OpenTableBookingResult {
  success: boolean;
  confirmationNumber?: string;
  error?: string;
  details?: any;
}

export interface OpenTableAcquisitionRequest {
  restaurantId: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h format)
  partySize: number;
  preferredTime?: string;
  timeFlexibility?: number; // Minutes
}

// ============================================
// API CLIENT
// ============================================

class OpenTableApiClient {
  private csrfToken: string;
  private firstName: string;
  private lastName: string;
  private email: string;
  private phone: string;

  constructor() {
    this.csrfToken = CSRF_TOKEN;
    this.firstName = FIRST_NAME;
    this.lastName = LAST_NAME;
    this.email = EMAIL;
    this.phone = PHONE;
  }

  private getHeaders(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'origin': 'https://www.opentable.com',
      'referer': 'https://www.opentable.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'x-csrf-token': this.csrfToken,
    };
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): { ready: boolean; hasToken: boolean; hasUserInfo: boolean } {
    return {
      ready: !!this.csrfToken && !!this.email && !!this.firstName && !!this.lastName,
      hasToken: !!this.csrfToken,
      hasUserInfo: !!this.email && !!this.firstName && !!this.lastName,
    };
  }

  /**
   * Find available slots at a restaurant
   */
  async findSlots(restaurantId: number, date: string, time: string, partySize: number): Promise<OpenTableSlot[]> {
    console.log(`[OpenTableAPI] Finding slots for restaurant ${restaurantId} on ${date} at ${time}`);

    try {
      const response = await axios.post(
        `${OPENTABLE_BASE_URL}/fe/gql?optype=query&opname=RestaurantsAvailability`,
        {
          operationName: 'RestaurantsAvailability',
          variables: {
            restaurantIds: [restaurantId],
            date: date,
            time: time,
            partySize: partySize,
            databaseRegion: 'NA',
          },
          extensions: {
            persistedQuery: {
              sha256Hash: 'e6b87021ed6e865a7778aa39d35d09864c1be29c683c707602dd3de43c854d86'
            }
          }
        },
        { headers: this.getHeaders(), timeout: 30000 }
      );

      const availability = response.data?.data?.availability?.[0];
      if (!availability?.availabilityDays?.[0]?.slots) {
        console.log('[OpenTableAPI] No slots found in response');
        return [];
      }

      const slots = availability.availabilityDays[0].slots
        .filter((slot: any) => slot.isAvailable)
        .map((slot: any) => ({
          dateTime: `${date}T${slot.time}`,
          isAvailable: slot.isAvailable,
          timeOffsetMinutes: slot.timeOffsetMinutes,
          slotAvailabilityToken: slot.slotAvailabilityToken,
          slotHash: slot.slotHash,
          attributes: slot.attributes || ['default'],
        }));

      console.log(`[OpenTableAPI] Found ${slots.length} available slots`);
      return slots;
    } catch (error: any) {
      console.error('[OpenTableAPI] Error finding slots:', error.response?.data || error.message);
      throw new Error(`Failed to find OpenTable slots: ${error.message}`);
    }
  }

  /**
   * Book a reservation
   */
  async makeReservation(
    restaurantId: number,
    slot: OpenTableSlot,
    date: string,
    time: string,
    partySize: number
  ): Promise<OpenTableBookingResult> {
    if (!this.csrfToken) {
      return { success: false, error: 'OPENTABLE_CSRF_TOKEN not configured' };
    }
    if (!this.email || !this.firstName || !this.lastName) {
      return { success: false, error: 'User info not configured (name, email)' };
    }

    console.log(`[OpenTableAPI] Booking ${restaurantId} at ${time} for ${partySize}`);

    try {
      const response = await axios.post(
        `${OPENTABLE_BASE_URL}/booking/make-reservation`,
        {
          restaurantId: restaurantId,
          slotAvailabilityToken: slot.slotAvailabilityToken,
          slotHash: slot.slotHash,
          isModify: false,
          reservationDateTime: `${date}T${time}`,
          partySize: partySize,
          firstName: this.firstName,
          lastName: this.lastName,
          email: this.email,
          country: 'US',
          reservationType: 'Standard',
          reservationAttribute: 'default',
          additionalServiceFees: [],
          tipAmount: 0,
          tipPercent: 0,
          pointsType: 'Standard',
          points: 100,
          diningAreaId: 1,
          phoneNumber: this.phone,
          phoneNumberCountryId: 'US',
          optInEmailRestaurant: false
        },
        { headers: this.getHeaders(), timeout: 30000 }
      );

      console.log('[OpenTableAPI] ✅ Reservation successful!');
      return {
        success: true,
        confirmationNumber: response.data.confirmationNumber || response.data.rid,
        details: response.data,
      };
    } catch (error: any) {
      console.error('[OpenTableAPI] ❌ Booking failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Full acquisition flow - find best slot and book it
   */
  async acquire(request: OpenTableAcquisitionRequest): Promise<OpenTableBookingResult> {
    const { restaurantId, date, time, partySize, timeFlexibility = 60 } = request;

    console.log(`[OpenTableAPI] 🎯 Starting acquisition for restaurant ${restaurantId}`);

    try {
      // Step 1: Find available slots
      const slots = await this.findSlots(restaurantId, date, time, partySize);

      if (!slots.length) {
        return { success: false, error: 'No slots available' };
      }

      // Step 2: Find the best matching slot (closest to requested time)
      let bestSlot = slots[0];
      let bestDiff = Math.abs(slots[0].timeOffsetMinutes);

      for (const slot of slots) {
        const diff = Math.abs(slot.timeOffsetMinutes);
        if (diff <= timeFlexibility && diff < bestDiff) {
          bestDiff = diff;
          bestSlot = slot;
        }
      }

      console.log(`[OpenTableAPI] Selected slot: ${bestSlot.dateTime}`);

      // Step 3: Make the reservation
      return await this.makeReservation(restaurantId, bestSlot, date, time, partySize);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Search for restaurants by name
   */
  async searchRestaurants(query: string, location?: string): Promise<OpenTableSearchResult[]> {
    console.log(`[OpenTableAPI] Searching for: "${query}"`);

    try {
      // OpenTable's search API
      const response = await axios.get(
        `https://www.opentable.com/s?term=${encodeURIComponent(query)}${location ? `&metroId=${location}` : ''}`,
        {
          headers: {
            'accept': 'application/json',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          },
          timeout: 30000,
        }
      );

      // Parse results from response
      // Note: This endpoint returns HTML, so you may need to use autocomplete API
      return [];
    } catch (error: any) {
      console.error('[OpenTableAPI] Search error:', error.message);
      return [];
    }
  }

  /**
   * Get restaurant info by ID (for validation)
   */
  async getRestaurantInfo(restaurantId: number): Promise<any | null> {
    try {
      const response = await axios.get(
        `${OPENTABLE_BASE_URL}/fe/gql?optype=query&opname=RestaurantProfile`,
        {
          params: {
            variables: JSON.stringify({ restaurantId }),
          },
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );
      return response.data?.data?.restaurant || null;
    } catch (error: any) {
      console.error('[OpenTableAPI] Get restaurant info error:', error.message);
      return null;
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const openTableClient = new OpenTableApiClient();

export default openTableClient;
export { OpenTableApiClient };

