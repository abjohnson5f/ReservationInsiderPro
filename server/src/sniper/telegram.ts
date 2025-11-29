/**
 * Telegram Command Center
 * 
 * Your pocket sniper control. Replaces Twilio with a full
 * bidirectional interface:
 * 
 * - Rich alerts with inline action buttons
 * - Command interface (/status, /snipe, /watch, etc.)
 * - Real-time status updates
 * - Direct control from your phone
 */

import TelegramBot, { InlineKeyboardButton, InlineKeyboardMarkup } from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

let bot: TelegramBot | null = null;
let isPolling = false;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the Telegram bot
 */
export const initialize = (): TelegramBot | null => {
  if (!BOT_TOKEN) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not configured. Telegram disabled.');
    return null;
  }

  if (bot) {
    console.log('[Telegram] Bot already initialized');
    return bot;
  }

  bot = new TelegramBot(BOT_TOKEN, { polling: false });
  console.log('✅ Telegram bot initialized');
  
  return bot;
};

/**
 * Start listening for commands (polling mode)
 */
export const startPolling = (): void => {
  if (!bot) {
    initialize();
  }
  
  if (!bot || isPolling) return;

  bot.startPolling();
  isPolling = true;
  console.log('[Telegram] 🟢 Polling started - listening for commands');
  
  // Register command handlers
  registerCommands();
};

/**
 * Stop polling
 */
export const stopPolling = (): void => {
  if (bot && isPolling) {
    bot.stopPolling();
    isPolling = false;
    console.log('[Telegram] 🔴 Polling stopped');
  }
};

// ============================================
// INLINE KEYBOARDS
// ============================================

const createKeyboard = (buttons: InlineKeyboardButton[][]): InlineKeyboardMarkup => ({
  inline_keyboard: buttons
});

const KEYBOARDS = {
  dropWarning: (restaurantId: string): InlineKeyboardMarkup => createKeyboard([
    [
      { text: '🔥 ARM SNIPER', callback_data: `arm:${restaurantId}` },
      { text: '⏭️ SKIP', callback_data: `skip:${restaurantId}` }
    ],
    [
      { text: '📊 DETAILS', callback_data: `details:${restaurantId}` }
    ]
  ]),

  dropImminent: (restaurantId: string): InlineKeyboardMarkup => createKeyboard([
    [
      { text: '🚀 SNIPE NOW', callback_data: `snipe:${restaurantId}` },
      { text: '❌ ABORT', callback_data: `abort:${restaurantId}` }
    ]
  ]),

  acquired: (restaurantId: string): InlineKeyboardMarkup => createKeyboard([
    [
      { text: '📞 CONFIRM CALL', callback_data: `voice_confirm:${restaurantId}` },
      { text: '💰 LOG PRICE', callback_data: `log_price:${restaurantId}` }
    ],
    [
      { text: '📋 VIEW PORTFOLIO', callback_data: 'portfolio' }
    ]
  ]),

  status: (): InlineKeyboardMarkup => createKeyboard([
    [
      { text: '▶️ START', callback_data: 'scheduler_start' },
      { text: '⏹️ STOP', callback_data: 'scheduler_stop' }
    ],
    [
      { text: '🔄 REFRESH', callback_data: 'status_refresh' }
    ]
  ]),

  confirm: (action: string): InlineKeyboardMarkup => createKeyboard([
    [
      { text: '✅ CONFIRM', callback_data: `confirm:${action}` },
      { text: '❌ CANCEL', callback_data: 'cancel' }
    ]
  ])
};

// ============================================
// MESSAGE SENDING
// ============================================

/**
 * Send a message to the configured chat
 */
export const send = async (
  text: string,
  keyboard?: InlineKeyboardMarkup
): Promise<TelegramBot.Message | null> => {
  if (!bot) initialize();
  if (!bot || !CHAT_ID) {
    console.error('[Telegram] Bot not initialized or CHAT_ID not set');
    return null;
  }

  try {
    const options: TelegramBot.SendMessageOptions = {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    if (keyboard) {
      options.reply_markup = keyboard;
    }

    const message = await bot.sendMessage(CHAT_ID, text, options);
    return message;
  } catch (error: any) {
    console.error('[Telegram] Send failed:', error.message);
    return null;
  }
};

/**
 * Edit an existing message
 */
export const editMessage = async (
  messageId: number,
  text: string,
  keyboard?: InlineKeyboardMarkup
): Promise<boolean> => {
  if (!bot || !CHAT_ID) return false;

  try {
    await bot.editMessageText(text, {
      chat_id: CHAT_ID,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    return true;
  } catch (error: any) {
    console.error('[Telegram] Edit failed:', error.message);
    return false;
  }
};

// ============================================
// NOTIFICATION TYPES
// ============================================

/**
 * Drop warning - 5 minutes before
 */
export const notifyDropWarning = async (
  restaurantName: string,
  dropTime: string,
  city?: string,
  restaurantId?: string
): Promise<void> => {
  const text = `
🎯 <b>SNIPER ALERT</b>

<b>${restaurantName}</b>
Drop in <b>5 MINUTES</b>

⏰ ${dropTime}
📍 ${city || 'Unknown location'}

<i>Get ready to strike.</i>
`;

  await send(text, KEYBOARDS.dropWarning(restaurantId || 'unknown'));
};

/**
 * Drop imminent - 1 minute before
 */
export const notifyDropImminent = async (
  restaurantName: string,
  restaurantId?: string
): Promise<void> => {
  const text = `
⚡ <b>${restaurantName}</b>

🔴 <b>DROP IN 60 SECONDS</b>

<code>FINGERS ON TRIGGERS</code>
`;

  await send(text, KEYBOARDS.dropImminent(restaurantId || 'unknown'));
};

/**
 * Reservation acquired
 */
export const notifyAcquired = async (
  restaurantName: string,
  price?: number,
  details?: string,
  restaurantId?: string
): Promise<void> => {
  const text = `
✅ <b>RESERVATION ACQUIRED!</b>

🍽️ <b>${restaurantName}</b>
${price ? `💰 Cost: $${price}` : ''}
${details ? `\n${details}` : ''}

🎉 <i>Money printer goes BRRR</i>
`;

  await send(text, KEYBOARDS.acquired(restaurantId || 'unknown'));
};

/**
 * Sold out / failed
 */
export const notifySoldOut = async (
  restaurantName: string,
  details?: string
): Promise<void> => {
  const text = `
❌ <b>SOLD OUT</b>

<b>${restaurantName}</b>
Inventory exhausted.

${details || 'Better luck next drop.'}

<i>Analyzing next opportunity...</i>
`;

  await send(text);
};

/**
 * Error occurred
 */
export const notifyError = async (
  restaurantName: string,
  details: string
): Promise<void> => {
  const text = `
🚨 <b>SNIPER ERROR</b>

<b>${restaurantName}</b>
${details}

<i>Manual intervention may be required.</i>
`;

  await send(text);
};

/**
 * Sniper armed
 */
export const notifySniperArmed = async (
  restaurantName: string,
  dropTime: string,
  city?: string
): Promise<void> => {
  const text = `
🟢 <b>SNIPER ARMED</b>

Now targeting <b>${restaurantName}</b>

⏰ Drop: ${dropTime}
📍 ${city || ''}

<i>Silent. Deadly. Ready.</i>
`;

  await send(text);
};

/**
 * Status update
 */
export const sendStatus = async (
  schedulerRunning: boolean,
  watchedCount: number,
  nextDrop?: { restaurant: string; time: Date } | null
): Promise<void> => {
  const statusEmoji = schedulerRunning ? '🟢' : '🔴';
  const statusText = schedulerRunning ? 'ACTIVE' : 'STOPPED';
  
  let text = `
📊 <b>SNIPER STATUS</b>

${statusEmoji} Scheduler: <b>${statusText}</b>
👁️ Watching: <b>${watchedCount}</b> targets
`;

  if (nextDrop) {
    const timeUntil = Math.round((nextDrop.time.getTime() - Date.now()) / 60000);
    text += `\n⏰ Next drop: <b>${nextDrop.restaurant}</b> in ${timeUntil} min`;
  }

  await send(text, KEYBOARDS.status());
};

// ============================================
// COMMAND HANDLERS
// ============================================

// Import these lazily to avoid circular deps
let scheduler: typeof import('./scheduler') | null = null;
let acquisitionBot: typeof import('./acquisitionBot') | null = null;

const getScheduler = async () => {
  if (!scheduler) {
    scheduler = await import('./scheduler');
  }
  return scheduler;
};

const getAcquisitionBot = async () => {
  if (!acquisitionBot) {
    acquisitionBot = await import('./acquisitionBot');
  }
  return acquisitionBot;
};

const registerCommands = (): void => {
  if (!bot) return;

  // /start - Welcome message
  bot.onText(/\/start/, async (msg) => {
    const text = `
🎯 <b>ReservationInsiderPro Sniper</b>

Welcome to your command center.

<b>Commands:</b>
/status - System status
/arm - Enable auto-snipe
/disarm - Disable auto-snipe
/watch - View watched restaurants
/portfolio - View holdings
/help - Show all commands

<i>Ready to hunt.</i>
`;
    await bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
    
    // Save chat ID if not set
    if (!CHAT_ID) {
      console.log(`[Telegram] 💡 Your CHAT_ID is: ${msg.chat.id}`);
      console.log('[Telegram] Add this to your .env: TELEGRAM_CHAT_ID=' + msg.chat.id);
    }
  });

  // Log all incoming messages for debugging
  bot.on('message', (msg) => {
    console.log(`[Telegram] Received message: "${msg.text}" from chat ${msg.chat.id} (${msg.chat.title || 'DM'})`);
  });

  // /status - Show current status
  bot.onText(/\/status/, async (msg) => {
    console.log('[Telegram] /status command triggered from chat:', msg.chat.id);
    
    // Send immediate acknowledgment
    await bot!.sendMessage(msg.chat.id, '📊 Checking status...').catch(e => console.error('Ack failed:', e));
    
    try {
      const sched = await getScheduler();
      console.log('[Telegram] Got scheduler');
      const status = sched.default.getStatus();
      console.log('[Telegram] Got status:', status);
      
      const statusEmoji = status.isRunning ? '🟢' : '🔴';
      const statusText = status.isRunning ? 'ACTIVE' : 'STOPPED';
      
      let text = `📊 <b>SNIPER STATUS</b>\n\n${statusEmoji} Scheduler: <b>${statusText}</b>\n👁️ Watching: <b>${status.watchedCount}</b> targets`;
      
      if (status.nextDrop) {
        const timeUntil = Math.round((status.nextDrop.time.getTime() - Date.now()) / 60000);
        text += `\n\n⏰ Next drop: <b>${status.nextDrop.restaurant}</b> in ${timeUntil} min`;
      }
      
      await bot!.sendMessage(msg.chat.id, text, { 
        parse_mode: 'HTML',
        reply_markup: KEYBOARDS.status()
      });
      console.log('[Telegram] Status sent!');
    } catch (error: any) {
      console.error('[Telegram] /status error:', error);
      await bot!.sendMessage(msg.chat.id, '❌ Error: ' + error.message).catch(() => {});
    }
  });

  // /arm - Start scheduler
  bot.onText(/\/arm/, async (msg) => {
    const sched = await getScheduler();
    sched.default.start();
    await bot!.sendMessage(msg.chat.id, '🟢 <b>SNIPER ARMED</b>\n\nScheduler started. Watching for drops.', { parse_mode: 'HTML' });
  });

  // /disarm - Stop scheduler
  bot.onText(/\/disarm/, async (msg) => {
    const sched = await getScheduler();
    sched.default.stop();
    await bot!.sendMessage(msg.chat.id, '🔴 <b>SNIPER DISARMED</b>\n\nScheduler stopped.', { parse_mode: 'HTML' });
  });

  // /watch - Show watched items
  bot.onText(/\/watch/, async (msg) => {
    const sched = await getScheduler();
    const watched = sched.default.getWatchedItems();
    
    if (watched.length === 0) {
      await bot!.sendMessage(msg.chat.id, '👁️ <b>No targets being watched</b>\n\nAdd items to your portfolio with status "WATCHING"', { parse_mode: 'HTML' });
      return;
    }

    let text = '👁️ <b>WATCHED TARGETS</b>\n\n';
    for (const item of watched) {
      const timeUntil = Math.round((item.dropTime.getTime() - Date.now()) / 60000);
      text += `• <b>${item.restaurantName}</b>\n  📱 ${item.platform} | ⏰ ${timeUntil}min\n\n`;
    }

    await bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  // /test - Test bot connection
  bot.onText(/\/test/, async (msg) => {
    const acqBot = await getAcquisitionBot();
    await bot!.sendMessage(msg.chat.id, '🧪 Testing browser connection...', { parse_mode: 'HTML' });
    
    const result = await acqBot.default.testConnection();
    
    if (result.success) {
      await bot!.sendMessage(msg.chat.id, `✅ <b>Browser OK</b>\n\nIP: <code>${result.ip}</code>`, { parse_mode: 'HTML' });
    } else {
      await bot!.sendMessage(msg.chat.id, `❌ <b>Browser Error</b>\n\n${result.error}`, { parse_mode: 'HTML' });
    }
  });

  // /help - Show all commands
  bot.onText(/\/help/, async (msg) => {
    const text = `
🎯 <b>SNIPER COMMANDS</b>

<b>Control:</b>
/status - System status
/arm - Start auto-snipe
/disarm - Stop auto-snipe

<b>Monitoring:</b>
/watch - View watched targets
/portfolio - View holdings

<b>Testing:</b>
/test - Test browser connection

<b>Info:</b>
/help - This message
/start - Welcome message
`;
    await bot!.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
  });

  // Handle inline keyboard callbacks
  bot.on('callback_query', async (query) => {
    if (!query.data || !query.message) return;

    const [action, id] = query.data.split(':');
    const sched = await getScheduler();

    switch (action) {
      case 'arm':
        await bot!.answerCallbackQuery(query.id, { text: '🔥 Sniper armed!' });
        await bot!.sendMessage(query.message.chat.id, `🔥 <b>ARMED</b> for ${id}`, { parse_mode: 'HTML' });
        break;

      case 'skip':
        await bot!.answerCallbackQuery(query.id, { text: 'Skipped' });
        await bot!.sendMessage(query.message.chat.id, `⏭️ Skipped ${id}`, { parse_mode: 'HTML' });
        break;

      case 'snipe':
        await bot!.answerCallbackQuery(query.id, { text: '🚀 Sniping!' });
        await bot!.sendMessage(query.message.chat.id, `🚀 <b>SNIPING ${id}...</b>`, { parse_mode: 'HTML' });
        // TODO: Trigger actual snipe
        break;

      case 'abort':
        await bot!.answerCallbackQuery(query.id, { text: 'Aborted' });
        await bot!.sendMessage(query.message.chat.id, `❌ Aborted ${id}`, { parse_mode: 'HTML' });
        break;

      case 'scheduler_start':
        sched.default.start();
        await bot!.answerCallbackQuery(query.id, { text: 'Scheduler started!' });
        const statusStart = sched.default.getStatus();
        await sendStatus(statusStart.isRunning, statusStart.watchedCount, statusStart.nextDrop);
        break;

      case 'scheduler_stop':
        sched.default.stop();
        await bot!.answerCallbackQuery(query.id, { text: 'Scheduler stopped' });
        const statusStop = sched.default.getStatus();
        await sendStatus(statusStop.isRunning, statusStop.watchedCount, statusStop.nextDrop);
        break;

      case 'status_refresh':
        await bot!.answerCallbackQuery(query.id, { text: 'Refreshed' });
        const statusRefresh = sched.default.getStatus();
        await sendStatus(statusRefresh.isRunning, statusRefresh.watchedCount, statusRefresh.nextDrop);
        break;

      case 'portfolio':
        await bot!.answerCallbackQuery(query.id, { text: 'Loading portfolio...' });
        await bot!.sendMessage(query.message.chat.id, '📋 Portfolio view coming soon...', { parse_mode: 'HTML' });
        break;

      case 'voice_confirm':
        await bot!.answerCallbackQuery(query.id, { text: 'Initiating call...' });
        await bot!.sendMessage(query.message.chat.id, '📞 Voice confirmation coming soon...', { parse_mode: 'HTML' });
        break;

      default:
        await bot!.answerCallbackQuery(query.id, { text: 'Unknown action' });
    }
  });

  console.log('[Telegram] Commands registered');
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Check if Telegram is configured
 */
export const isConfigured = (): boolean => {
  return !!(BOT_TOKEN && CHAT_ID);
};

/**
 * Check if bot token is set (can work without chat ID initially)
 */
export const hasToken = (): boolean => {
  return !!BOT_TOKEN;
};

/**
 * Get configuration status
 */
export const getConfigStatus = (): {
  botToken: boolean;
  chatId: boolean;
  polling: boolean;
  ready: boolean;
} => {
  return {
    botToken: !!BOT_TOKEN,
    chatId: !!CHAT_ID,
    polling: isPolling,
    ready: isConfigured()
  };
};

/**
 * Send a test message
 */
export const sendTest = async (): Promise<{ success: boolean; error?: string }> => {
  if (!isConfigured()) {
    return { success: false, error: 'Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID' };
  }

  const result = await send(`
🧪 <b>TEST NOTIFICATION</b>

ReservationInsiderPro Sniper is online.

<i>Your command center is ready.</i>
`, KEYBOARDS.status());

  return { success: !!result };
};

// Initialize on import
initialize();

export default {
  initialize,
  startPolling,
  stopPolling,
  send,
  editMessage,
  notifyDropWarning,
  notifyDropImminent,
  notifyAcquired,
  notifySoldOut,
  notifyError,
  notifySniperArmed,
  sendStatus,
  sendTest,
  isConfigured,
  hasToken,
  getConfigStatus
};

