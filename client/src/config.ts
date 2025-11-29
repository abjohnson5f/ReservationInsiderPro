/**
 * Application Configuration
 * 
 * Handles environment-specific settings
 */

// API Base URL - uses relative path in production (Nginx proxies to backend)
export const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3000/api' 
  : '/api';

// Sniper API
export const SNIPER_API = `${API_BASE}/sniper`;

// Analytics API  
export const ANALYTICS_API = `${API_BASE}/analytics`;

// Notifications API
export const NOTIFICATIONS_API = `${API_BASE}/notifications`;

// Identities API
export const IDENTITIES_API = `${API_BASE}/identities`;

// Transfers API
export const TRANSFERS_API = `${API_BASE}/transfers`;

// Portfolio API
export const PORTFOLIO_API = `${API_BASE}/portfolio`;

// Market API
export const MARKET_API = `${API_BASE}/v2/market`;

