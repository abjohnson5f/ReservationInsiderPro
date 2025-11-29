/**
 * Tock API Client - PRODUCTION IMPLEMENTATION
 * 
 * Tock is used by many fine-dining restaurants with prepaid reservations:
 * - Alinea, French Laundry, Eleven Madison Park, Smyth, etc.
 * 
 * Tock's API is more complex than Resy/OpenTable:
 * - Uses both REST and GraphQL
 * - Requires authentication for booking
 * - Prepaid tickets are the norm
 * 
 * API Endpoints:
 * - GET /api/consumer/booking/availability - Check availability
 * - POST /api/consumer/booking/... - Various booking steps
 * 
 * Required Environment Variables:
 * - TOCK_AUTH_TOKEN: Your auth token (from browser after logging in)
 * - TOCK_EMAIL: Your email
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const TOCK_BASE_URL = 'https://www.exploretock.com';
const TOCK_API_URL = 'https://api.exploretock.com';

// User credentials from environment
const AUTH_TOKEN = process.env.TOCK_AUTH_TOKEN || '';
const EMAIL = process.env.TOCK_EMAIL || process.env.OPENTABLE_EMAIL || '';

// ============================================
// TYPES
// ============================================

export interface TockExperience {
  id: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  duration?: number;
  partySize?: { min: number; max: number };
}

export interface TockSlot {
  id: string;
  startTime: string; // ISO datetime
  endTime: string;
  availableTickets: number;
  price: number;
  experienceId: string;
  experienceName: string;
}

export interface TockVenue {
  slug: string; // URL slug like "alinea"
  name: string;
  city: string;
  timezone?: string;
  experiences: TockExperience[];
}

export interface TockBookingResult {
  success: boolean;
  confirmationId?: string;
  ticketId?: string;
  error?: string;
  details?: any;
}

export interface TockAcquisitionRequest {
  venueSlug: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h format) - optional since Tock often has fixed times
  partySize: number;
  experienceId?: string; // Specific experience to book
  // Client info for concierge bookings (overrides default identity)
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

// ============================================
// API CLIENT
// ============================================

class TockApiClient {
  private authToken: string;
  private email: string;

  constructor() {
    this.authToken = AUTH_TOKEN;
    this.email = EMAIL;
  }

  private getHeaders(authenticated: boolean = false): Record<string, string> {
    const headers: Record<string, string> = {
      'accept': 'application/json',
      'origin': 'https://www.exploretock.com',
      'referer': 'https://www.exploretock.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (authenticated && this.authToken) {
      headers['authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): { ready: boolean; hasAuth: boolean; hasEmail: boolean } {
    return {
      ready: !!this.authToken && !!this.email,
      hasAuth: !!this.authToken,
      hasEmail: !!this.email,
    };
  }

  /**
   * Get venue information including experiences
   */
  async getVenueInfo(venueSlug: string): Promise<TockVenue | null> {
    console.log(`[TockAPI] Getting venue info for ${venueSlug}`);

    try {
      const response = await axios.get(
        `${TOCK_BASE_URL}/${venueSlug}/search`,
        {
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );

      // Tock embeds data in the page as JSON
      // This is a simplified version - real implementation would parse the page
      console.log('[TockAPI] Venue info fetched (requires parsing)');
      return null;
    } catch (error: any) {
      console.error('[TockAPI] Error getting venue info:', error.message);
      return null;
    }
  }

  /**
   * Find available slots/tickets
   */
  async findSlots(venueSlug: string, date: string, partySize: number): Promise<TockSlot[]> {
    console.log(`[TockAPI] Finding slots for ${venueSlug} on ${date} for ${partySize}`);

    try {
      // Tock's availability check
      const response = await axios.get(
        `${TOCK_BASE_URL}/api/consumer/booking/availability`,
        {
          params: {
            business: venueSlug,
            date: date,
            size: partySize,
          },
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );

      const slots: TockSlot[] = [];
      const data = response.data;

      // Parse availability from response
      if (data.availabilities && Array.isArray(data.availabilities)) {
        for (const avail of data.availabilities) {
          slots.push({
            id: avail.id,
            startTime: avail.start_time,
            endTime: avail.end_time,
            availableTickets: avail.tickets_available || avail.available,
            price: avail.price || 0,
            experienceId: avail.experience_id,
            experienceName: avail.experience_name || 'Dining',
          });
        }
      }

      console.log(`[TockAPI] Found ${slots.length} available slots`);
      return slots;
    } catch (error: any) {
      console.error('[TockAPI] Error finding slots:', error.response?.data || error.message);
      
      // Tock often requires login for availability, return empty if 401
      if (error.response?.status === 401) {
        console.log('[TockAPI] Authentication required for availability');
      }
      
      return [];
    }
  }

  /**
   * Add tickets to cart
   */
  async addToCart(slot: TockSlot, partySize: number): Promise<string | null> {
    if (!this.authToken) {
      console.warn('[TockAPI] Cannot add to cart without auth token');
      return null;
    }

    console.log(`[TockAPI] Adding ${partySize} tickets to cart for ${slot.startTime}`);

    try {
      const response = await axios.post(
        `${TOCK_API_URL}/api/consumer/cart/add`,
        {
          availability_id: slot.id,
          quantity: partySize,
        },
        {
          headers: {
            ...this.getHeaders(true),
            'content-type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data.cart_id || response.data.id;
    } catch (error: any) {
      console.error('[TockAPI] Error adding to cart:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Checkout cart
   * Optionally pass client info for concierge bookings
   */
  async checkout(
    cartId: string,
    clientInfo?: { firstName: string; lastName: string; email: string; phone: string }
  ): Promise<TockBookingResult> {
    if (!this.authToken) {
      return { success: false, error: 'TOCK_AUTH_TOKEN not configured' };
    }

    console.log(`[TockAPI] Checking out cart ${cartId}`);
    if (clientInfo) {
      console.log(`[TockAPI] Concierge booking for: ${clientInfo.firstName} ${clientInfo.lastName}`);
    }

    try {
      // Build checkout payload with guest info
      const checkoutPayload: any = {};
      
      if (clientInfo) {
        checkoutPayload.guest_first_name = clientInfo.firstName;
        checkoutPayload.guest_last_name = clientInfo.lastName;
        checkoutPayload.guest_email = clientInfo.email;
        checkoutPayload.guest_phone = clientInfo.phone;
      }

      const response = await axios.post(
        `${TOCK_API_URL}/api/consumer/cart/${cartId}/checkout`,
        checkoutPayload,
        {
          headers: {
            ...this.getHeaders(true),
            'content-type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return {
        success: true,
        confirmationId: response.data.confirmation_number,
        ticketId: response.data.ticket_id,
        details: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        details: error.response?.data,
      };
    }
  }

  /**
   * Full acquisition flow
   * Supports concierge bookings with client info override
   */
  async acquire(request: TockAcquisitionRequest): Promise<TockBookingResult> {
    const { venueSlug, date, time, partySize, experienceId, firstName, lastName, email, phone } = request;

    console.log(`[TockAPI] 🎯 Starting acquisition for ${venueSlug}`);

    try {
      // Step 1: Find available slots
      const slots = await this.findSlots(venueSlug, date, partySize);

      if (!slots.length) {
        return { success: false, error: 'No slots available' };
      }

      // Step 2: Find the best matching slot
      let bestSlot = slots[0];
      
      if (time) {
        const targetMinutes = this.timeToMinutes(time);
        let bestDiff = Infinity;

        for (const slot of slots) {
          const slotTime = new Date(slot.startTime);
          const slotMinutes = slotTime.getHours() * 60 + slotTime.getMinutes();
          const diff = Math.abs(slotMinutes - targetMinutes);
          
          if (diff < bestDiff) {
            bestDiff = diff;
            bestSlot = slot;
          }
        }
      }

      if (experienceId) {
        const matchingSlot = slots.find(s => s.experienceId === experienceId);
        if (matchingSlot) {
          bestSlot = matchingSlot;
        }
      }

      console.log(`[TockAPI] Selected slot: ${bestSlot.startTime} - ${bestSlot.experienceName}`);

      // Step 3: Add to cart
      const cartId = await this.addToCart(bestSlot, partySize);
      if (!cartId) {
        return { success: false, error: 'Failed to add to cart' };
      }

      // Step 4: Prepare client info for concierge booking if provided
      const clientInfo = firstName && lastName && email && phone
        ? { firstName, lastName, email, phone }
        : undefined;

      // Step 5: Checkout
      return await this.checkout(cartId, clientInfo);
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Convert "HH:MM" to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
  }

  /**
   * Search for venues on Tock
   */
  async searchVenues(query: string, location?: string): Promise<any[]> {
    console.log(`[TockAPI] Searching for: "${query}"`);

    try {
      const response = await axios.get(
        `${TOCK_BASE_URL}/api/consumer/search`,
        {
          params: {
            q: query,
            location: location,
          },
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );

      return response.data.results || [];
    } catch (error: any) {
      console.error('[TockAPI] Search error:', error.message);
      return [];
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const tockClient = new TockApiClient();

export default tockClient;
export { TockApiClient };

