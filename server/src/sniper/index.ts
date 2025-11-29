/**
 * Sniper Module - Phase 3
 * 
 * The 24/7 automation layer for ReservationInsiderPro.
 * 
 * Components:
 * - telegram: Command center (primary notifications + control)
 * - scheduler: Cron-based drop time monitoring
 * - acquisitionBot: Puppeteer headless browser
 * - voiceAgent: ElevenLabs AI phone calls
 * - notifications: Twilio SMS (legacy fallback)
 */

export * as telegram from './telegram';
export * as scheduler from './scheduler';
export * as acquisitionBot from './acquisitionBot';
export * as voiceAgent from './voiceAgent';
export * as notifications from './notifications';

// Re-export defaults for convenience
export { default as telegramService } from './telegram';
export { default as schedulerService } from './scheduler';
export { default as acquisitionBotService } from './acquisitionBot';
export { default as voiceAgentService } from './voiceAgent';
export { default as notificationService } from './notifications';


