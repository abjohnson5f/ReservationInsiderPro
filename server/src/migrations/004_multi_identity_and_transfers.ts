/**
 * Migration 004: Multi-Identity System & Transfer Tracking
 * 
 * This migration adds:
 * 1. booking_identities - Store multiple user credentials for platform rotation
 * 2. transfers - Track reservation transfers to buyers
 * 3. at_listings - Track AppointmentTrader listings
 */

export const up = `
-- ============================================
-- BOOKING IDENTITIES TABLE
-- Stores credentials for multiple users (you + Vlad)
-- ============================================
CREATE TABLE IF NOT EXISTS booking_identities (
  id SERIAL PRIMARY KEY,
  
  -- Identity info
  name VARCHAR(100) NOT NULL,           -- "Alex" or "Vlad"
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  
  -- Resy credentials
  resy_auth_token TEXT,
  resy_payment_id VARCHAR(100),
  resy_api_key VARCHAR(100) DEFAULT 'VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5',
  
  -- OpenTable credentials  
  opentable_csrf_token TEXT,
  opentable_session_cookie TEXT,
  opentable_gpid VARCHAR(255),
  
  -- SevenRooms credentials
  sevenrooms_first_name VARCHAR(100),
  sevenrooms_last_name VARCHAR(100),
  sevenrooms_email VARCHAR(255),
  sevenrooms_phone VARCHAR(20),
  
  -- Tock credentials
  tock_auth_token TEXT,
  tock_email VARCHAR(255),
  tock_phone VARCHAR(20),
  
  -- Usage tracking
  bookings_this_month INTEGER DEFAULT 0,
  last_booking_date TIMESTAMP,
  monthly_limit INTEGER DEFAULT 6,       -- Per platform soft limit
  
  -- Platform-specific booking counts
  resy_bookings_month INTEGER DEFAULT 0,
  opentable_bookings_month INTEGER DEFAULT 0,
  sevenrooms_bookings_month INTEGER DEFAULT 0,
  tock_bookings_month INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TRANSFERS TABLE  
-- Track reservation transfers to AT buyers
-- ============================================
CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  
  -- Link to portfolio item
  portfolio_item_id VARCHAR(255) REFERENCES portfolio_items(id),
  
  -- Reservation details (denormalized for quick access)
  restaurant_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time VARCHAR(10) NOT NULL,
  party_size INTEGER NOT NULL,
  confirmation_number VARCHAR(100),
  
  -- AT listing info
  at_listing_id VARCHAR(100),
  at_listing_url TEXT,
  listing_price DECIMAL(10, 2),
  
  -- Buyer info (filled when sold)
  buyer_name VARCHAR(255),
  buyer_email VARCHAR(255),
  buyer_phone VARCHAR(20),
  sale_price DECIMAL(10, 2),
  sold_at TIMESTAMP,
  
  -- Transfer status workflow
  status VARCHAR(50) DEFAULT 'ACQUIRED',  -- ACQUIRED -> LISTED -> SOLD -> TRANSFER_PENDING -> TRANSFERRED -> COMPLETED
  
  -- Transfer details
  transfer_method VARCHAR(50),           -- 'NAME_CHANGE', 'CANCEL_REBOOK', 'PLATFORM_TRANSFER', 'SHOW_UP_TOGETHER'
  transfer_deadline TIMESTAMP,
  transfer_completed_at TIMESTAMP,
  transfer_notes TEXT,
  
  -- Identity used for booking
  booking_identity_id INTEGER REFERENCES booking_identities(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- AT LISTINGS TABLE
-- Quick reference for AT listing status
-- ============================================
CREATE TABLE IF NOT EXISTS at_listings (
  id SERIAL PRIMARY KEY,
  
  transfer_id INTEGER REFERENCES transfers(id),
  
  -- AT platform data
  at_listing_id VARCHAR(100),
  at_url TEXT,
  
  -- Listing details
  restaurant_name VARCHAR(255) NOT NULL,
  listing_date DATE NOT NULL,
  listing_time VARCHAR(10) NOT NULL,
  party_size INTEGER NOT NULL,
  asking_price DECIMAL(10, 2) NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'DRAFT',    -- DRAFT -> ACTIVE -> SOLD -> EXPIRED -> CANCELLED
  views INTEGER DEFAULT 0,
  inquiries INTEGER DEFAULT 0,
  
  -- Quick-copy text (pre-formatted for AT)
  listing_title TEXT,
  listing_description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_identities_active ON booking_identities(is_active);
CREATE INDEX IF NOT EXISTS idx_identities_bookings ON booking_identities(bookings_this_month);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_deadline ON transfers(transfer_deadline);
CREATE INDEX IF NOT EXISTS idx_at_listings_status ON at_listings(status);

-- ============================================
-- MONTHLY RESET FUNCTION
-- Resets booking counts on 1st of each month
-- ============================================
CREATE OR REPLACE FUNCTION reset_monthly_booking_counts()
RETURNS void AS $$
BEGIN
  UPDATE booking_identities 
  SET 
    bookings_this_month = 0,
    resy_bookings_month = 0,
    opentable_bookings_month = 0,
    sevenrooms_bookings_month = 0,
    tock_bookings_month = 0,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
`;

export const down = `
DROP FUNCTION IF EXISTS reset_monthly_booking_counts();
DROP TABLE IF EXISTS at_listings;
DROP TABLE IF EXISTS transfers;
DROP TABLE IF EXISTS booking_identities;
`;

// Run migration
import pool from '../db';

export async function runMigration() {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  const client = await pool.connect();
  try {
    console.log('[Migration 004] Starting multi-identity and transfers migration...');
    await client.query(up);
    console.log('[Migration 004] ✅ Migration completed successfully');
  } catch (error: any) {
    console.error('[Migration 004] ❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Execute if run directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

