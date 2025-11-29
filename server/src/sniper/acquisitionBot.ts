/**
 * Acquisition Bot (Puppeteer + Bright Data)
 * 
 * Headless browser automation for grabbing reservations.
 * Supports two modes:
 * 1. Bright Data Scraping Browser (recommended) - bypasses anti-bot
 * 2. Local Puppeteer with residential proxy fallback
 * 
 * Supported Platforms:
 * - Resy (fully implemented)
 * - OpenTable
 * - Tock
 * - SevenRooms
 * - Direct restaurant booking pages
 */

import puppeteerExtra from 'puppeteer-extra';
import puppeteerCore from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as notifications from './notifications';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Add stealth plugin to puppeteer-extra (only used for local browser)
puppeteerExtra.use(StealthPlugin());

// ============================================
// CONFIGURATION
// ============================================

const PROXY_URL = process.env.PROXY_URL || '';
const BRIGHTDATA_SCRAPING_BROWSER = process.env.BRIGHTDATA_SCRAPING_BROWSER || ''; // wss://brd-customer-...@brd.superproxy.io:9222
const HEADLESS = process.env.PUPPETEER_HEADLESS !== 'false';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Helper function to replace deprecated waitForTimeout
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Platform credentials (stored securely in env)
const RESY_EMAIL = process.env.RESY_EMAIL || '';
const RESY_PASSWORD = process.env.RESY_PASSWORD || '';

// Selectors for each platform
const SELECTORS = {
  resy: {
    // Main booking flow
    dateButton: '[data-test="date-picker-button"]',
    dateInput: '[data-test="date-picker-input"]',
    timeSlot: '[data-test="time-slot"]',
    bookButton: '[data-test="book-button"]',
    reserveButton: 'button:has-text("Reserve")',
    
    // Alternative selectors (Resy updates frequently)
    availableSlot: '.ReservationButton',
    slotTime: '.ReservationButton__time',
    confirmButton: '.Button--primary',
    
    // Auth flow
    loginEmail: 'input[name="email"]',
    loginPassword: 'input[name="password"]',
    loginSubmit: 'button[type="submit"]',
    
    // Success indicators
    confirmationNumber: '.Confirmation__number',
    successMessage: '.Confirmation__message'
  },
  
  opentable: {
    dateInput: '#restProfileSummary_0 input[type="date"]',
    timeSelect: '#restProfileSummary_0 select',
    partySizeSelect: '#restProfileSummary_0 select[name="partySize"]',
    findTableButton: 'button:has-text("Find a time")',
    availableSlot: '.dtp-picker-result',
    bookButton: 'button:has-text("Complete reservation")'
  },
  
  tock: {
    dateButton: '[data-testid="date-picker"]',
    timeSlot: '[data-testid="timeslot"]',
    addToCart: 'button:has-text("Add to cart")',
    checkout: 'button:has-text("Checkout")'
  }
};

// Parse proxy URL if provided
const parseProxyUrl = (url: string): { host: string; port: string; username?: string; password?: string } | null => {
  if (!url) return null;
  
  try {
    // Format: http://username:password@host:port
    const match = url.match(/^https?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)$/);
    if (match) {
      return {
        username: match[1],
        password: match[2],
        host: match[3],
        port: match[4]
      };
    }
    
    // Format without auth: http://host:port
    const simpleMatch = url.match(/^https?:\/\/([^:]+):(\d+)$/);
    if (simpleMatch) {
      return {
        host: simpleMatch[1],
        port: simpleMatch[2]
      };
    }
  } catch (e) {
    console.error('[AcquisitionBot] Failed to parse proxy URL:', e);
  }
  
  return null;
};

// ============================================
// TYPES
// ============================================

interface AcquisitionTarget {
  restaurantName: string;
  bookingUrl: string;
  date: string;           // YYYY-MM-DD
  time: string;           // HH:MM
  partySize: number;
  platform?: 'resy' | 'opentable' | 'tock' | 'sevenrooms' | 'direct';
}

interface AcquisitionResult {
  success: boolean;
  restaurantName: string;
  confirmationCode?: string;
  error?: string;
  screenshot?: string;    // Base64 encoded screenshot
  timeTaken: number;      // Milliseconds
}

// ============================================
// BROWSER MANAGEMENT
// ============================================

let browser: Browser | null = null;
let usingScrapingBrowser = false;

/**
 * Launch browser - prefers Bright Data Scraping Browser if configured
 * 
 * Bright Data Scraping Browser handles:
 * - CAPTCHA solving automatically
 * - Browser fingerprint randomization
 * - IP rotation with residential IPs
 * - JavaScript rendering
 */
export const launchBrowser = async (): Promise<Browser> => {
  // Option 1: Bright Data Scraping Browser (recommended for anti-bot)
  // Use puppeteer-core (no stealth plugin) since Bright Data handles anti-bot
  if (BRIGHTDATA_SCRAPING_BROWSER) {
    try {
      console.log('[AcquisitionBot] Connecting to Bright Data Scraping Browser...');
      browser = await puppeteerCore.connect({
        browserWSEndpoint: BRIGHTDATA_SCRAPING_BROWSER
      }) as Browser;
      usingScrapingBrowser = true;
      console.log('[AcquisitionBot] ✅ Connected to Bright Data Scraping Browser');
      return browser;
    } catch (error: any) {
      console.error('[AcquisitionBot] Failed to connect to Scraping Browser:', error.message);
      console.log('[AcquisitionBot] Falling back to local browser...');
    }
  }

  // Option 2: Local Puppeteer with stealth plugin and proxy
  const proxyConfig = parseProxyUrl(PROXY_URL);
  
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080'
  ];

  // Add proxy if configured
  if (proxyConfig) {
    args.push(`--proxy-server=http://${proxyConfig.host}:${proxyConfig.port}`);
    console.log(`[AcquisitionBot] Using proxy: ${proxyConfig.host}:${proxyConfig.port}`);
  } else {
    console.log('[AcquisitionBot] No proxy configured - using direct connection');
  }

  browser = await puppeteerExtra.launch({
    headless: HEADLESS,
    args,
    defaultViewport: { width: 1920, height: 1080 }
  }) as Browser;

  usingScrapingBrowser = false;
  console.log('[AcquisitionBot] Browser launched (local with stealth)');
  return browser;
};

/**
 * Close browser
 */
export const closeBrowser = async (): Promise<void> => {
  if (browser) {
    await browser.close();
    browser = null;
    console.log('[AcquisitionBot] Browser closed');
  }
};

/**
 * Get or create browser instance
 */
const getBrowser = async (): Promise<Browser> => {
  if (!browser) {
    return launchBrowser();
  }
  return browser;
};

/**
 * Create a new page with proxy authentication
 */
const createPage = async (): Promise<Page> => {
  const b = await getBrowser();
  const page = await b.newPage();
  
  // Only set these for local browser - Bright Data handles all of this automatically
  // and doesn't allow overriding these headers
  if (!usingScrapingBrowser) {
    // Set proxy authentication if needed
    const proxyConfig = parseProxyUrl(PROXY_URL);
    if (proxyConfig?.username && proxyConfig?.password) {
      await page.authenticate({
        username: proxyConfig.username,
        password: proxyConfig.password
      });
    }

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
  }

  return page;
};

// ============================================
// PLATFORM-SPECIFIC HANDLERS
// ============================================

/**
 * Handle Resy booking
 * 
 * Flow:
 * 1. Navigate to restaurant page
 * 2. Look for available time slots matching target time
 * 3. Click the slot to start booking
 * 4. Handle authentication if needed
 * 5. Confirm the reservation
 */
const handleResy = async (page: Page, target: AcquisitionTarget): Promise<boolean> => {
  console.log('[AcquisitionBot] 🎯 Starting Resy acquisition flow...');
  
  try {
    // Navigate to booking page
    await page.goto(target.bookingUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
    console.log('[AcquisitionBot] Page loaded');
    
    // Wait for reservation buttons to load
    await page.waitForSelector('.ReservationButton, [data-test="time-slot"], button[class*="Reservation"]', { 
      timeout: 15000 
    }).catch(() => console.log('[AcquisitionBot] No standard slots found, trying alternatives...'));

    // Find available time slots
    const slots = await page.$$('.ReservationButton, [data-test="time-slot"], button[class*="Reservation"]');
    console.log(`[AcquisitionBot] Found ${slots.length} available slots`);

    if (slots.length === 0) {
      console.log('[AcquisitionBot] No slots available - inventory may not have dropped yet');
      return false;
    }

    // Look for a slot matching our target time (or take any available if urgent)
    let targetSlot = null;
    for (const slot of slots) {
      const slotText = await slot.evaluate(el => el.textContent?.toLowerCase() || '');
      console.log(`[AcquisitionBot] Checking slot: ${slotText}`);
      
      // Match target time (e.g., "7:00 PM" for target.time = "19:00")
      const targetHour = parseInt(target.time.split(':')[0]);
      const targetMinute = parseInt(target.time.split(':')[1]);
      const targetTimeStr = formatTime(targetHour, targetMinute);
      
      if (slotText.includes(targetTimeStr.toLowerCase())) {
        targetSlot = slot;
        console.log(`[AcquisitionBot] ✅ Found matching slot: ${slotText}`);
        break;
      }
    }

    // If no exact match, take the first available slot (snipe mode)
    if (!targetSlot && slots.length > 0) {
      targetSlot = slots[0];
      const slotText = await targetSlot.evaluate(el => el.textContent || '');
      console.log(`[AcquisitionBot] No exact match, taking first available: ${slotText}`);
    }

    if (!targetSlot) {
      console.log('[AcquisitionBot] No suitable slot found');
      return false;
    }

    // Click the reservation slot
    await targetSlot.click();
    console.log('[AcquisitionBot] Clicked reservation slot');

    // Wait for booking modal/page to load
    await delay(2000);

    // Check if we need to authenticate
    const needsAuth = await page.$('input[name="email"], input[type="email"]');
    if (needsAuth && RESY_EMAIL && RESY_PASSWORD) {
      console.log('[AcquisitionBot] Authentication required, logging in...');
      await handleResyAuth(page);
    }

    // Look for and click the reserve/confirm button
    const confirmSelectors = [
      'button:has-text("Reserve")',
      'button:has-text("Complete")',
      'button:has-text("Confirm")',
      '.Button--primary',
      '[data-test="book-button"]',
      'button[type="submit"]'
    ];

    for (const selector of confirmSelectors) {
      try {
        const confirmBtn = await page.$(selector);
        if (confirmBtn) {
          await confirmBtn.click();
          console.log(`[AcquisitionBot] Clicked confirm button: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    // Wait for confirmation
    await delay(3000);

    // Check for success indicators
    const successIndicators = [
      '.Confirmation',
      '[data-test="confirmation"]',
      'text=confirmed',
      'text=Confirmation'
    ];

    for (const indicator of successIndicators) {
      const success = await page.$(indicator);
      if (success) {
        console.log('[AcquisitionBot] ✅ Reservation confirmed!');
        return true;
      }
    }

    // Check page content for confirmation
    const pageContent = await page.content();
    if (pageContent.toLowerCase().includes('confirmation') || 
        pageContent.toLowerCase().includes('you\'re all set') ||
        pageContent.toLowerCase().includes('reservation confirmed')) {
      console.log('[AcquisitionBot] ✅ Reservation confirmed (via page content)!');
      return true;
    }

    console.log('[AcquisitionBot] ⚠️ Booking attempted but confirmation unclear');
    return false;

  } catch (error: any) {
    console.error('[AcquisitionBot] Resy error:', error.message);
    return false;
  }
};

/**
 * Handle Resy authentication
 */
const handleResyAuth = async (page: Page): Promise<void> => {
  try {
    // Enter email
    await page.type('input[name="email"], input[type="email"]', RESY_EMAIL, { delay: 50 });
    
    // Look for password field (might be on same page or next page)
    await delay(500);
    
    const passwordField = await page.$('input[name="password"], input[type="password"]');
    if (passwordField) {
      await page.type('input[name="password"], input[type="password"]', RESY_PASSWORD, { delay: 50 });
    }
    
    // Submit
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await delay(2000);
    }
    
    console.log('[AcquisitionBot] Authentication submitted');
  } catch (error: any) {
    console.error('[AcquisitionBot] Auth error:', error.message);
  }
};

/**
 * Format time from 24h to 12h format
 */
const formatTime = (hour: number, minute: number): string => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const minStr = minute.toString().padStart(2, '0');
  return `${hour12}:${minStr} ${period}`;
};

/**
 * Handle OpenTable booking
 */
const handleOpenTable = async (page: Page, target: AcquisitionTarget): Promise<boolean> => {
  console.log('[AcquisitionBot] 🎯 Starting OpenTable acquisition flow...');
  
  try {
    await page.goto(target.bookingUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
    
    // Wait for time slots to appear
    await page.waitForSelector('.dtp-picker-result, [data-test="times-702"]', { timeout: 15000 })
      .catch(() => console.log('[AcquisitionBot] Looking for OpenTable slots...'));

    // Find and click available slot
    const slots = await page.$$('.dtp-picker-result button, [data-test^="times-"] button');
    console.log(`[AcquisitionBot] Found ${slots.length} OpenTable slots`);

    if (slots.length > 0) {
      // Find matching time or take first available
      const targetHour = parseInt(target.time.split(':')[0]);
      const targetTimeStr = formatTime(targetHour, 0);
      
      for (const slot of slots) {
        const slotText = await slot.evaluate(el => el.textContent?.toLowerCase() || '');
        if (slotText.includes(targetTimeStr.toLowerCase().replace(' ', ''))) {
          await slot.click();
          console.log(`[AcquisitionBot] Clicked OpenTable slot: ${slotText}`);
          await delay(2000);
          
          // Look for complete reservation button
          const completeBtn = await page.$('button:has-text("Complete"), button[data-test="complete-reservation"]');
          if (completeBtn) {
            await completeBtn.click();
            await delay(3000);
            return true;
          }
          break;
        }
      }
    }

    return false;
  } catch (error: any) {
    console.error('[AcquisitionBot] OpenTable error:', error.message);
    return false;
  }
};

/**
 * Handle Tock booking (prepaid reservations)
 */
const handleTock = async (page: Page, target: AcquisitionTarget): Promise<boolean> => {
  console.log('[AcquisitionBot] 🎯 Starting Tock acquisition flow...');
  
  try {
    await page.goto(target.bookingUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
    
    // Tock uses a different flow - prepaid tickets
    await page.waitForSelector('[data-testid="timeslot"], .timeslot-button, button[class*="TimeSlot"]', { timeout: 15000 })
      .catch(() => console.log('[AcquisitionBot] Looking for Tock slots...'));

    const slots = await page.$$('[data-testid="timeslot"], .timeslot-button, button[class*="TimeSlot"]');
    console.log(`[AcquisitionBot] Found ${slots.length} Tock slots`);

    if (slots.length > 0) {
      // Click first available slot
      await slots[0].click();
      console.log('[AcquisitionBot] Clicked Tock slot');
      await delay(2000);

      // Add to cart
      const addToCartBtn = await page.$('button:has-text("Add to cart"), button:has-text("Add")');
      if (addToCartBtn) {
        await addToCartBtn.click();
        await delay(2000);

        // Proceed to checkout
        const checkoutBtn = await page.$('button:has-text("Checkout"), a:has-text("Checkout")');
        if (checkoutBtn) {
          await checkoutBtn.click();
          await delay(3000);
          
          // Note: Tock requires payment info - may need manual completion
          console.log('[AcquisitionBot] Tock: Reached checkout - may need manual payment completion');
          return true;
        }
      }
    }

    return false;
  } catch (error: any) {
    console.error('[AcquisitionBot] Tock error:', error.message);
    return false;
  }
};

/**
 * Handle SevenRooms booking
 */
const handleSevenRooms = async (page: Page, target: AcquisitionTarget): Promise<boolean> => {
  console.log('[AcquisitionBot] SevenRooms handler not fully implemented - navigating to page');
  
  await page.goto(target.bookingUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
  await page.waitForSelector('body', { timeout: DEFAULT_TIMEOUT });
  
  // TODO: Implement SevenRooms-specific booking flow
  
  return false;
};

/**
 * Handle direct booking page (generic)
 */
const handleDirect = async (page: Page, target: AcquisitionTarget): Promise<boolean> => {
  console.log('[AcquisitionBot] Direct booking - navigating to page');
  
  await page.goto(target.bookingUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
  await page.waitForSelector('body', { timeout: DEFAULT_TIMEOUT });
  
  // Take screenshot for manual review
  return false;
};

/**
 * Detect platform from URL
 */
const detectPlatform = (url: string): AcquisitionTarget['platform'] => {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('resy.com')) return 'resy';
  if (lowerUrl.includes('opentable.com')) return 'opentable';
  if (lowerUrl.includes('exploretock.com') || lowerUrl.includes('tock.')) return 'tock';
  if (lowerUrl.includes('sevenrooms.com')) return 'sevenrooms';
  
  return 'direct';
};

// ============================================
// MAIN ACQUISITION FUNCTION
// ============================================

/**
 * Attempt to acquire a reservation
 */
export const acquire = async (target: AcquisitionTarget): Promise<AcquisitionResult> => {
  const startTime = Date.now();
  let page: Page | null = null;
  
  console.log(`[AcquisitionBot] Starting acquisition for ${target.restaurantName}`);
  console.log(`[AcquisitionBot] URL: ${target.bookingUrl}`);
  console.log(`[AcquisitionBot] Date: ${target.date}, Time: ${target.time}, Party: ${target.partySize}`);

  try {
    page = await createPage();
    
    // Detect platform if not specified
    const platform = target.platform || detectPlatform(target.bookingUrl);
    console.log(`[AcquisitionBot] Detected platform: ${platform}`);

    let success = false;

    switch (platform) {
      case 'resy':
        success = await handleResy(page, target);
        break;
      case 'opentable':
        success = await handleOpenTable(page, target);
        break;
      case 'tock':
        success = await handleTock(page, target);
        break;
      case 'sevenrooms':
        success = await handleSevenRooms(page, target);
        break;
      default:
        success = await handleDirect(page, target);
    }

    // Take screenshot regardless of outcome
    const screenshot = await page.screenshot({ encoding: 'base64' }) as string;

    const timeTaken = Date.now() - startTime;

    if (success) {
      console.log(`[AcquisitionBot] ✅ Successfully acquired ${target.restaurantName}`);
      await notifications.notifyAcquired(target.restaurantName, 0, `Acquired via ${platform}`);
    } else {
      console.log(`[AcquisitionBot] ⚠️ Manual intervention needed for ${target.restaurantName}`);
      await notifications.notify({
        type: 'ACQUIRED',
        restaurantName: target.restaurantName,
        details: `Page loaded on ${platform}. Screenshot captured. Manual booking may be required.`
      });
    }

    return {
      success,
      restaurantName: target.restaurantName,
      screenshot,
      timeTaken
    };

  } catch (error: any) {
    const timeTaken = Date.now() - startTime;
    console.error(`[AcquisitionBot] ❌ Error acquiring ${target.restaurantName}:`, error.message);
    
    // Take error screenshot if possible
    let screenshot: string | undefined;
    if (page) {
      try {
        screenshot = await page.screenshot({ encoding: 'base64' }) as string;
      } catch (e) {
        // Ignore screenshot error
      }
    }

    await notifications.notifyError(target.restaurantName, error.message);

    return {
      success: false,
      restaurantName: target.restaurantName,
      error: error.message,
      screenshot,
      timeTaken
    };

  } finally {
    if (page) {
      await page.close();
    }
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Test browser and proxy connection
 */
export const testConnection = async (): Promise<{
  success: boolean;
  ip?: string;
  usingBrightData?: boolean;
  error?: string;
}> => {
  let page: Page | null = null;

  try {
    page = await createPage();
    
    // Go to httpbin which is allowed by Bright Data
    await page.goto('https://httpbin.org/ip', { 
      waitUntil: 'networkidle2',
      timeout: 60000 // Longer timeout for Bright Data
    });

    // Get IP from httpbin response
    const content = await page.evaluate(() => document.body.innerText);
    const ipData = JSON.parse(content);
    const ip = ipData.origin || 'Unknown';

    console.log(`[AcquisitionBot] Connection test successful. IP: ${ip}`);

    return { success: true, ip, usingBrightData: usingScrapingBrowser };

  } catch (error: any) {
    console.error('[AcquisitionBot] Connection test failed:', error.message);
    return { success: false, error: error.message };

  } finally {
    if (page) {
      await page.close();
    }
  }
};

/**
 * Check if bot is configured
 */
export const isConfigured = (): boolean => {
  return true; // Puppeteer works without proxy, proxy is optional
};

/**
 * Check if proxy is configured
 */
export const hasProxy = (): boolean => {
  return !!PROXY_URL && PROXY_URL.length > 0;
};

export default {
  launchBrowser,
  closeBrowser,
  acquire,
  testConnection,
  isConfigured,
  hasProxy
};


