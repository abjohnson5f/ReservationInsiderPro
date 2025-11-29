/**
 * SevenRooms API Client - PRODUCTION IMPLEMENTATION
 * 
 * Uses SevenRooms' public widget API (same as their booking widgets).
 * Based on: https://github.com/jasonpraful/sevenrooms
 * 
 * API Endpoints:
 * - GET /api-yoa/availability/widget/range - Check availability
 * - POST (booking endpoint) - Make reservation
 * 
 * Note: SevenRooms is used by many high-end restaurants:
 * - NoMad, Mister Jiu's, Atomix, etc.
 * 
 * Required Environment Variables:
 * - SEVENROOMS_FIRST_NAME: Your first name
 * - SEVENROOMS_LAST_NAME: Your last name
 * - SEVENROOMS_EMAIL: Your email
 * - SEVENROOMS_PHONE: Your phone number
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const SEVENROOMS_BASE_URL = 'https://www.sevenrooms.com';

// User credentials from environment
const FIRST_NAME = process.env.SEVENROOMS_FIRST_NAME || process.env.OPENTABLE_FIRST_NAME || '';
const LAST_NAME = process.env.SEVENROOMS_LAST_NAME || process.env.OPENTABLE_LAST_NAME || '';
const EMAIL = process.env.SEVENROOMS_EMAIL || process.env.OPENTABLE_EMAIL || '';
const PHONE = process.env.SEVENROOMS_PHONE || process.env.OPENTABLE_PHONE || '';

// ============================================
// TYPES
// ============================================

export interface SevenRoomsSlot {
  time: string; // "19:00"
  timeIso: string; // "2024-12-01 19:00"
  accessPersistentId: string | null;
  publicTimeSlotDescription?: string; // e.g., "Outdoor Seating"
  isAvailable: boolean;
  shiftPersistentId?: string;
  shiftCategory?: string;
}

export interface SevenRoomsVenue {
  id: string; // URL slug like "nomad-las-vegas"
  name: string;
  city?: string;
  timezone?: string;
}

export interface SevenRoomsBookingResult {
  success: boolean;
  confirmationId?: string;
  error?: string;
  details?: any;
}

export interface SevenRoomsAcquisitionRequest {
  venueSlug: string; // e.g., "nomad-las-vegas"
  date: string; // YYYY-MM-DD
  time: string; // HH:MM (24h format)
  partySize: number;
  timeFlexibility?: number; // Minutes
}

// ============================================
// API CLIENT
// ============================================

class SevenRoomsApiClient {
  private firstName: string;
  private lastName: string;
  private email: string;
  private phone: string;

  constructor() {
    this.firstName = FIRST_NAME;
    this.lastName = LAST_NAME;
    this.email = EMAIL;
    this.phone = PHONE;
  }

  private getHeaders(): Record<string, string> {
    return {
      'accept': 'application/json',
      'origin': 'https://www.sevenrooms.com',
      'referer': 'https://www.sevenrooms.com/',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): { ready: boolean; hasUserInfo: boolean } {
    return {
      ready: !!this.email && !!this.firstName && !!this.lastName,
      hasUserInfo: !!this.email && !!this.firstName && !!this.lastName,
    };
  }

  /**
   * Convert YYYY-MM-DD to MM-DD-YYYY (SevenRooms format)
   */
  private formatDate(date: string): string {
    const [year, month, day] = date.split('-');
    return `${month}-${day}-${year}`;
  }

  /**
   * Find available slots at a venue
   */
  async findSlots(venueSlug: string, date: string, time: string, partySize: number): Promise<SevenRoomsSlot[]> {
    console.log(`[SevenRoomsAPI] Finding slots for ${venueSlug} on ${date} at ${time}`);

    try {
      const formattedDate = this.formatDate(date);
      const url = `${SEVENROOMS_BASE_URL}/api-yoa/availability/widget/range`;
      
      const response = await axios.get(url, {
        params: {
          venue: venueSlug,
          time_slot: time,
          party_size: partySize,
          halo_size_interval: 16, // Search range (+/- 2 hours in 15-min increments)
          start_date: formattedDate,
          num_days: 1,
          channel: 'SEVENROOMS_WIDGET',
        },
        headers: this.getHeaders(),
        timeout: 30000,
      });

      const availabilityData = response.data?.data?.availability?.[date]?.[0]?.times;
      
      if (!availabilityData || !Array.isArray(availabilityData)) {
        console.log('[SevenRoomsAPI] No availability data in response');
        return [];
      }

      const slots: SevenRoomsSlot[] = availabilityData
        .filter((slot: any) => slot.access_persistent_id !== null)
        .map((slot: any) => ({
          time: slot.time,
          timeIso: slot.time_iso,
          accessPersistentId: slot.access_persistent_id,
          publicTimeSlotDescription: slot.public_time_slot_description,
          isAvailable: slot.access_persistent_id !== null,
          shiftPersistentId: slot.shift_persistent_id,
          shiftCategory: slot.shift_category,
        }));

      console.log(`[SevenRoomsAPI] Found ${slots.length} available slots`);
      return slots;
    } catch (error: any) {
      console.error('[SevenRoomsAPI] Error finding slots:', error.response?.data || error.message);
      throw new Error(`Failed to find SevenRooms slots: ${error.message}`);
    }
  }

  /**
   * Get reservation details/hold
   */
  async getReservationDetails(venueSlug: string, slot: SevenRoomsSlot, partySize: number): Promise<any> {
    console.log(`[SevenRoomsAPI] Getting reservation details for ${slot.timeIso}`);

    try {
      const response = await axios.get(
        `${SEVENROOMS_BASE_URL}/api-yoa/reservation/details`,
        {
          params: {
            venue: venueSlug,
            shift_persistent_id: slot.shiftPersistentId,
            access_persistent_id: slot.accessPersistentId,
            party_size: partySize,
            time_iso: slot.timeIso,
          },
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );

      return response.data?.data || null;
    } catch (error: any) {
      console.error('[SevenRoomsAPI] Error getting reservation details:', error.message);
      return null;
    }
  }

  /**
   * Complete reservation booking
   */
  async makeReservation(
    venueSlug: string,
    slot: SevenRoomsSlot,
    partySize: number,
    details?: any
  ): Promise<SevenRoomsBookingResult> {
    if (!this.email || !this.firstName || !this.lastName) {
      return { success: false, error: 'User info not configured (name, email)' };
    }

    console.log(`[SevenRoomsAPI] Booking ${venueSlug} at ${slot.time} for ${partySize}`);

    try {
      // SevenRooms booking requires a session/hold first
      // This is typically done via their widget which handles the full flow
      
      // First, create a hold on the reservation
      const holdResponse = await axios.post(
        `${SEVENROOMS_BASE_URL}/api-yoa/reservation/create`,
        {
          venue: venueSlug,
          shift_persistent_id: slot.shiftPersistentId,
          access_persistent_id: slot.accessPersistentId,
          party_size: partySize,
          time_slot: slot.time,
          first_name: this.firstName,
          last_name: this.lastName,
          email: this.email,
          phone_number: this.phone,
          notes: '',
          channel: 'SEVENROOMS_WIDGET',
        },
        {
          headers: {
            ...this.getHeaders(),
            'content-type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (holdResponse.data?.data?.confirmation_number) {
        console.log('[SevenRoomsAPI] ✅ Reservation successful!');
        return {
          success: true,
          confirmationId: holdResponse.data.data.confirmation_number,
          details: holdResponse.data.data,
        };
      }

      return {
        success: false,
        error: 'Booking response did not contain confirmation',
        details: holdResponse.data,
      };
    } catch (error: any) {
      console.error('[SevenRoomsAPI] ❌ Booking failed:', error.response?.data || error.message);
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
  async acquire(request: SevenRoomsAcquisitionRequest): Promise<SevenRoomsBookingResult> {
    const { venueSlug, date, time, partySize, timeFlexibility = 60 } = request;

    console.log(`[SevenRoomsAPI] 🎯 Starting acquisition for ${venueSlug}`);

    try {
      // Step 1: Find available slots
      const slots = await this.findSlots(venueSlug, date, time, partySize);

      if (!slots.length) {
        return { success: false, error: 'No slots available' };
      }

      // Step 2: Find the best matching slot
      const targetMinutes = this.timeToMinutes(time);
      let bestSlot = slots[0];
      let bestDiff = Infinity;

      for (const slot of slots) {
        const slotMinutes = this.timeToMinutes(slot.time);
        const diff = Math.abs(slotMinutes - targetMinutes);
        if (diff <= timeFlexibility && diff < bestDiff) {
          bestDiff = diff;
          bestSlot = slot;
        }
      }

      console.log(`[SevenRoomsAPI] Selected slot: ${bestSlot.time} (${bestSlot.publicTimeSlotDescription || 'Standard'})`);

      // Step 3: Get reservation details
      const details = await this.getReservationDetails(venueSlug, bestSlot, partySize);

      // Step 4: Make the reservation
      return await this.makeReservation(venueSlug, bestSlot, partySize, details);
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
   * Check availability for a date range (useful for monitoring)
   */
  async checkAvailabilityRange(
    venueSlug: string,
    startDate: string,
    numDays: number,
    time: string,
    partySize: number
  ): Promise<Record<string, SevenRoomsSlot[]>> {
    console.log(`[SevenRoomsAPI] Checking availability for ${numDays} days starting ${startDate}`);

    try {
      const formattedDate = this.formatDate(startDate);
      const response = await axios.get(
        `${SEVENROOMS_BASE_URL}/api-yoa/availability/widget/range`,
        {
          params: {
            venue: venueSlug,
            time_slot: time,
            party_size: partySize,
            halo_size_interval: 16,
            start_date: formattedDate,
            num_days: numDays,
            channel: 'SEVENROOMS_WIDGET',
          },
          headers: this.getHeaders(),
          timeout: 30000,
        }
      );

      const result: Record<string, SevenRoomsSlot[]> = {};
      const availabilityData = response.data?.data?.availability || {};

      for (const [date, dayData] of Object.entries(availabilityData)) {
        const times = (dayData as any)?.[0]?.times || [];
        result[date] = times
          .filter((slot: any) => slot.access_persistent_id !== null)
          .map((slot: any) => ({
            time: slot.time,
            timeIso: slot.time_iso,
            accessPersistentId: slot.access_persistent_id,
            publicTimeSlotDescription: slot.public_time_slot_description,
            isAvailable: true,
          }));
      }

      return result;
    } catch (error: any) {
      console.error('[SevenRoomsAPI] Error checking availability range:', error.message);
      return {};
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

const sevenRoomsClient = new SevenRoomsApiClient();

export default sevenRoomsClient;
export { SevenRoomsApiClient };

