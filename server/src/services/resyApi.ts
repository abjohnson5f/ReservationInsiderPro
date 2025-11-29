/**
 * Resy API Client - PRODUCTION IMPLEMENTATION
 * 
 * This uses Resy's actual JSON API (same as their website/mobile app).
 * NO HTML SCRAPING. NO GUESSED SELECTORS. THIS IS THE REAL THING.
 * 
 * API Endpoints:
 * - GET /4/find - Search for available reservation slots
 * - GET /3/details - Get booking token for a specific slot
 * - POST /3/book - Complete the reservation
 * 
 * Required Environment Variables:
 * - RESY_AUTH_TOKEN: Your auth token (from browser after logging in)
 * - RESY_PAYMENT_ID: Your payment method ID (from Resy account)
 * 
 * How to get your auth token:
 * 1. Go to resy.com and log in
 * 2. Open Chrome DevTools → Network tab
 * 3. Click on any restaurant
 * 4. Find any api.resy.com request
 * 5. Copy the 'x-resy-auth-token' header value
 */

import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

// Public API key - this is the same for everyone (it's in the website's JS bundle)
const RESY_API_KEY = 'VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5';
const RESY_BASE_URL = 'https://api.resy.com';

// User credentials from environment
const AUTH_TOKEN = process.env.RESY_AUTH_TOKEN || '';
const PAYMENT_ID = process.env.RESY_PAYMENT_ID || '';

// ============================================
// TYPES
// ============================================

export interface ResySlot {
  config_id: string;
  date: {
    start: string;
    end: string;
  };
  shift: {
    day: string;
    shift_type: string;
  };
  size: {
    min: number;
    max: number;
  };
  payment: {
    cancellation_fee: number | null;
    deposit_fee: number | null;
    service_charge: number | null;
  };
  table: {
    type: string;
    table_id: number;
  };
  time_slot: string; // e.g., "7:00 PM"
}

export interface ResyVenue {
  id: number;
  name: string;
  location: {
    city: string;
    neighborhood: string;
  };
  slots: ResySlot[];
}

export interface ResyFindResponse {
  results: {
    venues: Array<{
      venue: {
        id: number;
        name: string;
        price_range: number;
        rating: number;
        location: {
          city: string;
          neighborhood: string;
        };
      };
      slots: ResySlot[];
    }>;
  };
}

export interface ResyBookingDetails {
  book_token: {
    value: string;
    date_expires: string;
  };
  venue: {
    name: string;
  };
  user: {
    first_name: string;
    last_name: string;
    em_address: string;
    phone_number: string;
  };
}

export interface ResyBookingResult {
  success: boolean;
  resy_token?: string;
  reservation_id?: string;
  confirmation?: string;
  error?: string;
  details?: any;
}

export interface AcquisitionRequest {
  venueId: number;
  date: string; // YYYY-MM-DD
  partySize: number;
  preferredTime?: string; // HH:MM (24h format)
  timeFlexibility?: number; // Minutes before/after preferred time
}

// ============================================
// API CLIENT
// ============================================

class ResyApiClient {
  private authToken: string;
  private paymentId: string;

  constructor(authToken?: string, paymentId?: string) {
    this.authToken = authToken || AUTH_TOKEN;
    this.paymentId = paymentId || PAYMENT_ID;
  }

  /**
   * Make a request to the Resy API with proper headers
   */
  private async makeRequest(method: 'get' | 'post', url: string, data?: any): Promise<any> {
    const headers: Record<string, string> = {
      'authorization': `ResyAPI api_key="${RESY_API_KEY}"`,
      'origin': 'https://resy.com',
      'referer': 'https://resy.com/',
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    // Add auth token for authenticated requests
    if (this.authToken) {
      headers['x-resy-auth-token'] = this.authToken;
      headers['x-resy-universal-auth'] = this.authToken;
    }

    const config: any = {
      method,
      url: `${RESY_BASE_URL}${url}`,
      headers,
      timeout: 30000,
    };

    if (data && method === 'post') {
      config.data = data;
      config.headers['content-type'] = 'application/x-www-form-urlencoded';
    }

    return axios(config);
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): { ready: boolean; hasAuth: boolean; hasPayment: boolean } {
    return {
      ready: !!this.authToken && !!this.paymentId,
      hasAuth: !!this.authToken,
      hasPayment: !!this.paymentId,
    };
  }

  /**
   * Find available reservation slots at a venue
   */
  async findSlots(venueId: number, date: string, partySize: number): Promise<ResySlot[]> {
    console.log(`[ResyAPI] Finding slots for venue ${venueId} on ${date} for ${partySize} guests`);
    
    try {
      const url = `/4/find?lat=0&long=0&day=${date}&party_size=${partySize}&venue_id=${venueId}`;
      console.log(`[ResyAPI] Request URL: ${RESY_BASE_URL}${url}`);
      
      const response = await this.makeRequest('get', url);
      
      console.log(`[ResyAPI] Response status: ${response.status}`);
      
      const data = response.data as ResyFindResponse;

      if (!data.results?.venues?.length) {
        console.log('[ResyAPI] No venues found in response');
        return [];
      }

      const slots = data.results.venues[0].slots || [];
      console.log(`[ResyAPI] Found ${slots.length} available slots`);
      
      // Also return venue info for reference
      const venue = data.results.venues[0].venue;
      console.log(`[ResyAPI] Venue: ${venue?.name || 'Unknown'}`);
      
      return slots;
    } catch (error: any) {
      console.error('[ResyAPI] Error finding slots:');
      console.error('  Status:', error.response?.status);
      console.error('  StatusText:', error.response?.statusText);
      console.error('  Data:', JSON.stringify(error.response?.data || {}).substring(0, 500));
      console.error('  Message:', error.message);
      throw new Error(`Failed to find slots: ${error.response?.status || error.message}`);
    }
  }

  /**
   * Get the booking token for a specific slot
   */
  async getBookingToken(configId: string, date: string, partySize: number): Promise<string> {
    console.log(`[ResyAPI] Getting booking token for config: ${configId}`);
    
    try {
      const encodedConfigId = encodeURIComponent(configId);
      const url = `/3/details?day=${date}&party_size=${partySize}&config_id=${encodedConfigId}`;
      
      const response = await this.makeRequest('get', url);

      const bookToken = response.data.book_token?.value;
      if (!bookToken) {
        throw new Error('No book_token in response');
      }

      console.log('[ResyAPI] Successfully obtained booking token');
      return bookToken;
    } catch (error: any) {
      console.error('[ResyAPI] Error getting booking token:', error.response?.data || error.message);
      throw new Error(`Failed to get booking token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Complete the reservation booking
   */
  async makeReservation(bookToken: string): Promise<ResyBookingResult> {
    if (!this.authToken) {
      return { success: false, error: 'RESY_AUTH_TOKEN not configured' };
    }
    if (!this.paymentId) {
      return { success: false, error: 'RESY_PAYMENT_ID not configured' };
    }

    console.log('[ResyAPI] Attempting to book reservation...');

    try {
      // Build form data (Resy uses URL-encoded form data for booking)
      const formData = new URLSearchParams();
      formData.append('book_token', bookToken);
      formData.append('struct_payment_method', JSON.stringify({ id: parseInt(this.paymentId) }));
      formData.append('source_id', 'resy.com-venue-details');

      const response = await this.makeRequest('post', '/3/book', formData.toString());

      console.log('[ResyAPI] ✅ Reservation successful!', response.data);

      return {
        success: true,
        resy_token: response.data.resy_token,
        reservation_id: response.data.reservation_id,
        confirmation: response.data.resy_token || 'Confirmed',
        details: response.data,
      };
    } catch (error: any) {
      const errorData = error.response?.data;
      console.error('[ResyAPI] ❌ Booking failed:', errorData || error.message);

      // Parse specific error messages from Resy
      let errorMessage = 'Booking failed';
      if (errorData?.message) {
        errorMessage = errorData.message;
      } else if (errorData?.status === 412) {
        errorMessage = 'Slot no longer available';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed - check your RESY_AUTH_TOKEN';
      }

      return {
        success: false,
        error: errorMessage,
        details: errorData,
      };
    }
  }

  /**
   * Full acquisition flow - find best slot and book it
   */
  async acquire(request: AcquisitionRequest): Promise<ResyBookingResult> {
    const { venueId, date, partySize, preferredTime, timeFlexibility = 60 } = request;

    console.log(`[ResyAPI] 🎯 Starting acquisition for venue ${venueId}`);
    console.log(`[ResyAPI] Date: ${date}, Party: ${partySize}, Preferred: ${preferredTime || 'any'}`);

    try {
      // Step 1: Find available slots
      const slots = await this.findSlots(venueId, date, partySize);
      
      if (!slots.length) {
        return {
          success: false,
          error: 'No slots available',
        };
      }

      // Step 2: Find the best matching slot
      let bestSlot: ResySlot | null = null;
      
      if (preferredTime) {
        // Convert preferred time to comparable format
        const targetMinutes = this.timeToMinutes(preferredTime);
        let closestDiff = Infinity;

        for (const slot of slots) {
          const slotTime = this.parseSlotTime(slot.time_slot || slot.date?.start);
          if (slotTime !== null) {
            const diff = Math.abs(slotTime - targetMinutes);
            if (diff <= timeFlexibility && diff < closestDiff) {
              closestDiff = diff;
              bestSlot = slot;
            }
          }
        }
      }

      // If no match within flexibility window, take first available
      if (!bestSlot) {
        bestSlot = slots[0];
        console.log(`[ResyAPI] Using first available slot: ${bestSlot.time_slot || bestSlot.date?.start}`);
      } else {
        console.log(`[ResyAPI] Found matching slot: ${bestSlot.time_slot || bestSlot.date?.start}`);
      }

      // Step 3: Get the booking token
      const bookToken = await this.getBookingToken(bestSlot.config_id, date, partySize);

      // Step 4: Make the reservation
      const result = await this.makeReservation(bookToken);
      
      return result;
    } catch (error: any) {
      console.error('[ResyAPI] Acquisition failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Helper: Convert "HH:MM" to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Helper: Parse Resy's time slot format to minutes
   */
  private parseSlotTime(timeStr: string): number | null {
    if (!timeStr) return null;

    // Handle ISO format: "2024-12-01T19:00:00"
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return date.getHours() * 60 + date.getMinutes();
    }

    // Handle display format: "7:00 PM"
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3]?.toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return hours * 60 + minutes;
    }

    return null;
  }

  /**
   * Search for a venue by name
   * Note: Uses autocomplete API which is more reliable
   */
  async searchVenue(query: string, city?: string): Promise<any[]> {
    console.log(`[ResyAPI] Searching for venue: "${query}"`);
    
    try {
      // Use the autocomplete API instead of venuesearch
      const url = `/3/autocomplete?types=venue&query=${encodeURIComponent(query)}&per_page=10`;
      const response = await this.makeRequest('get', url);

      const venues = response.data.results?.venues || [];
      console.log(`[ResyAPI] Found ${venues.length} venues`);
      
      return venues.map((venue: any) => ({
        id: venue.id,
        name: venue.name,
        city: venue.location?.city || venue.city,
        neighborhood: venue.location?.neighborhood || venue.neighborhood,
        cuisine: Array.isArray(venue.cuisine) ? venue.cuisine.join(', ') : venue.cuisine,
        priceRange: venue.price_range,
      }));
    } catch (error: any) {
      console.error('[ResyAPI] Venue search error:', error.response?.status, error.message);
      return [];
    }
  }

  /**
   * Check for existing reservations
   */
  async getUpcomingReservations(): Promise<any[]> {
    if (!this.authToken) {
      console.warn('[ResyAPI] Cannot check reservations without auth token');
      return [];
    }

    try {
      const url = '/3/user/reservations?limit=10&offset=1&type=upcoming';
      const response = await this.makeRequest('get', url);

      return response.data.reservations || [];
    } catch (error: any) {
      console.error('[ResyAPI] Error fetching reservations:', error.message);
      return [];
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const resyClient = new ResyApiClient();

export default resyClient;
export { ResyApiClient };

