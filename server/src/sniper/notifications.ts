/**
 * Sniper Notifications Service
 * 
 * Handles all alert notifications via Twilio SMS.
 * Used by the Sniper system to notify on:
 * - Drop time approaching (T-5 minutes warning)
 * - Reservation acquired successfully
 * - Acquisition failed / sold out
 * - Price alerts (significant market movement)
 */

import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

// Your personal phone number for receiving alerts
const ALERT_RECIPIENT = process.env.ALERT_PHONE_NUMBER || '+1XXXXXXXXXX';

let client: twilio.Twilio | null = null;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
  console.log('✅ Twilio SMS client initialized');
} else {
  console.warn('⚠️ Twilio credentials not configured. SMS notifications disabled.');
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType = 
  | 'DROP_WARNING'      // T-5 minutes before drop
  | 'DROP_IMMINENT'     // T-1 minute before drop
  | 'ACQUIRED'          // Successfully got reservation
  | 'SOLD_OUT'          // Failed - sold out
  | 'ERROR'             // System error
  | 'PRICE_ALERT'       // Significant price movement
  | 'SNIPER_STARTED'    // Sniper bot activated
  | 'SNIPER_STOPPED';   // Sniper bot stopped

interface NotificationPayload {
  type: NotificationType;
  restaurantName: string;
  city?: string;
  details?: string;
  price?: number;
  dropTime?: string;
}

// ============================================
// MESSAGE TEMPLATES
// ============================================

const getMessageTemplate = (payload: NotificationPayload): string => {
  const { type, restaurantName, city, details, price, dropTime } = payload;
  
  switch (type) {
    case 'DROP_WARNING':
      return `🎯 SNIPER ALERT\n\n${restaurantName} drop in 5 MINUTES!\n⏰ ${dropTime}\n📍 ${city || 'Unknown'}\n\nGet ready to strike.`;
    
    case 'DROP_IMMINENT':
      return `⚡ ${restaurantName}\nDROP IN 60 SECONDS\n\nFINGERS ON TRIGGERS`;
    
    case 'ACQUIRED':
      return `✅ RESERVATION ACQUIRED!\n\n🍽️ ${restaurantName}\n💰 Cost: $${price || 0}\n${details || ''}\n\n🎉 Money printer goes BRRR`;
    
    case 'SOLD_OUT':
      return `❌ SOLD OUT\n\n${restaurantName} - Inventory exhausted.\n${details || 'Better luck next drop.'}\n\nAnalyzing next opportunity...`;
    
    case 'ERROR':
      return `🚨 SNIPER ERROR\n\n${restaurantName}\n${details || 'Unknown error occurred.'}\n\nManual intervention may be required.`;
    
    case 'PRICE_ALERT':
      return `📊 PRICE MOVEMENT\n\n${restaurantName}\n💵 Now trading at $${price}\n${details || ''}\n\nMarket is moving.`;
    
    case 'SNIPER_STARTED':
      return `🟢 SNIPER ACTIVATED\n\nNow watching ${restaurantName}\n⏰ Drop: ${dropTime}\n📍 ${city || ''}\n\nSilent. Deadly. Ready.`;
    
    case 'SNIPER_STOPPED':
      return `🔴 SNIPER STOPPED\n\n${restaurantName} removed from watch list.\n${details || ''}`;
    
    default:
      return `📱 ReservationInsiderPro\n\n${restaurantName}\n${details || 'Notification'}`;
  }
};

// ============================================
// CORE SEND FUNCTION
// ============================================

export const sendSMS = async (
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  if (!client) {
    console.error('❌ Twilio client not initialized');
    return { success: false, error: 'Twilio not configured' };
  }

  if (!twilioPhone) {
    console.error('❌ Twilio phone number not configured');
    return { success: false, error: 'Twilio phone not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: to
    });

    console.log(`📱 SMS sent: ${result.sid}`);
    return { success: true, messageId: result.sid };
  } catch (error: any) {
    console.error('❌ SMS send failed:', error.message);
    return { success: false, error: error.message };
  }
};

// ============================================
// HIGH-LEVEL NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send a typed notification to the default alert recipient
 */
export const notify = async (
  payload: NotificationPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const message = getMessageTemplate(payload);
  return sendSMS(ALERT_RECIPIENT, message);
};

/**
 * Drop warning - 5 minutes before
 */
export const notifyDropWarning = async (
  restaurantName: string,
  dropTime: string,
  city?: string
) => {
  return notify({
    type: 'DROP_WARNING',
    restaurantName,
    dropTime,
    city
  });
};

/**
 * Drop imminent - 1 minute before
 */
export const notifyDropImminent = async (restaurantName: string) => {
  return notify({
    type: 'DROP_IMMINENT',
    restaurantName
  });
};

/**
 * Reservation acquired successfully
 */
export const notifyAcquired = async (
  restaurantName: string,
  price: number,
  details?: string
) => {
  return notify({
    type: 'ACQUIRED',
    restaurantName,
    price,
    details
  });
};

/**
 * Sold out / failed to acquire
 */
export const notifySoldOut = async (
  restaurantName: string,
  details?: string
) => {
  return notify({
    type: 'SOLD_OUT',
    restaurantName,
    details
  });
};

/**
 * Error occurred
 */
export const notifyError = async (
  restaurantName: string,
  details: string
) => {
  return notify({
    type: 'ERROR',
    restaurantName,
    details
  });
};

/**
 * Significant price movement detected
 */
export const notifyPriceAlert = async (
  restaurantName: string,
  price: number,
  details?: string
) => {
  return notify({
    type: 'PRICE_ALERT',
    restaurantName,
    price,
    details
  });
};

/**
 * Sniper activated for a restaurant
 */
export const notifySniperStarted = async (
  restaurantName: string,
  dropTime: string,
  city?: string
) => {
  return notify({
    type: 'SNIPER_STARTED',
    restaurantName,
    dropTime,
    city
  });
};

/**
 * Sniper stopped watching
 */
export const notifySniperStopped = async (
  restaurantName: string,
  details?: string
) => {
  return notify({
    type: 'SNIPER_STOPPED',
    restaurantName,
    details
  });
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if notifications are properly configured
 */
export const isConfigured = (): boolean => {
  return !!(client && twilioPhone && ALERT_RECIPIENT !== '+1XXXXXXXXXX');
};

/**
 * Send a test notification
 */
export const sendTestNotification = async (): Promise<{ success: boolean; error?: string }> => {
  if (!isConfigured()) {
    return { success: false, error: 'Twilio not fully configured. Check TWILIO_* and ALERT_PHONE_NUMBER env vars.' };
  }

  return sendSMS(
    ALERT_RECIPIENT,
    '🧪 TEST NOTIFICATION\n\nReservationInsiderPro Sniper is online and ready.\n\nThis is a test message.'
  );
};

export default {
  sendSMS,
  notify,
  notifyDropWarning,
  notifyDropImminent,
  notifyAcquired,
  notifySoldOut,
  notifyError,
  notifyPriceAlert,
  notifySniperStarted,
  notifySniperStopped,
  isConfigured,
  sendTestNotification
};


