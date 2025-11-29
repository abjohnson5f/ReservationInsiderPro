/**
 * Migration: Confirmed Drop Patterns
 * 
 * Stores confirmed reservation drop patterns learned from successful acquisitions.
 * This allows the system to:
 * - Predict accurate drop times for future reservations
 * - Build a database of restaurant-specific timing patterns
 * - Improve success rates over time
 */

export const up = `
-- Table to store confirmed drop patterns
CREATE TABLE IF NOT EXISTS confirmed_drop_patterns (
  id SERIAL PRIMARY KEY,
  portfolio_item_id VARCHAR(255) UNIQUE,
  restaurant_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  
  -- Drop timing info
  days_in_advance INTEGER NOT NULL,  -- How many days before the target date reservations drop
  drop_time VARCHAR(10) NOT NULL,     -- HH:MM format
  drop_timezone VARCHAR(50) DEFAULT 'America/New_York',
  
  -- Success tracking
  confirmed_at TIMESTAMP DEFAULT NOW(),
  success_count INTEGER DEFAULT 1,
  attempt_count INTEGER DEFAULT 1,
  success_rate DECIMAL(3,2) DEFAULT 1.0,
  
  -- Restaurant identifiers (for cross-referencing)
  resy_venue_id INTEGER,
  opentable_id INTEGER,
  sevenrooms_slug VARCHAR(255),
  tock_slug VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups by restaurant name
CREATE INDEX IF NOT EXISTS idx_drop_patterns_restaurant ON confirmed_drop_patterns(restaurant_name);

-- Index for platform-specific queries
CREATE INDEX IF NOT EXISTS idx_drop_patterns_platform ON confirmed_drop_patterns(platform);

-- Add platform-specific ID columns to portfolio_items if they don't exist
DO $$ 
BEGIN
  -- Resy venue ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='portfolio_items' AND column_name='resy_venue_id') THEN
    ALTER TABLE portfolio_items ADD COLUMN resy_venue_id INTEGER;
  END IF;
  
  -- OpenTable restaurant ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='portfolio_items' AND column_name='opentable_id') THEN
    ALTER TABLE portfolio_items ADD COLUMN opentable_id INTEGER;
  END IF;
  
  -- SevenRooms slug
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='portfolio_items' AND column_name='sevenrooms_slug') THEN
    ALTER TABLE portfolio_items ADD COLUMN sevenrooms_slug VARCHAR(255);
  END IF;
  
  -- Tock slug
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='portfolio_items' AND column_name='tock_slug') THEN
    ALTER TABLE portfolio_items ADD COLUMN tock_slug VARCHAR(255);
  END IF;

  -- Target reservation date (the date we want to BOOK, not when it drops)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='portfolio_items' AND column_name='target_date') THEN
    ALTER TABLE portfolio_items ADD COLUMN target_date VARCHAR(10);
  END IF;
END $$;

-- Acquisition log for tracking all attempts
CREATE TABLE IF NOT EXISTS acquisition_log (
  id SERIAL PRIMARY KEY,
  portfolio_item_id VARCHAR(255),
  restaurant_name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  
  -- Attempt details
  attempted_at TIMESTAMP DEFAULT NOW(),
  duration_ms INTEGER,
  attempts INTEGER DEFAULT 1,
  
  -- Result
  success BOOLEAN NOT NULL,
  confirmation_code VARCHAR(255),
  error_message TEXT,
  
  -- Request details
  target_date VARCHAR(10),
  target_time VARCHAR(10),
  party_size INTEGER,
  
  -- Metadata
  trigger_type VARCHAR(50), -- 'manual', 'scheduled', 'drop_time'
  response_data JSONB
);

-- Index for querying acquisition history
CREATE INDEX IF NOT EXISTS idx_acquisition_log_restaurant ON acquisition_log(restaurant_name);
CREATE INDEX IF NOT EXISTS idx_acquisition_log_date ON acquisition_log(attempted_at);
`;

export const down = `
DROP TABLE IF EXISTS acquisition_log;
DROP TABLE IF EXISTS confirmed_drop_patterns;

-- Remove added columns (optional, can leave them)
-- ALTER TABLE portfolio_items DROP COLUMN IF EXISTS resy_venue_id;
-- ALTER TABLE portfolio_items DROP COLUMN IF EXISTS opentable_id;
-- ALTER TABLE portfolio_items DROP COLUMN IF EXISTS sevenrooms_slug;
-- ALTER TABLE portfolio_items DROP COLUMN IF EXISTS tock_slug;
-- ALTER TABLE portfolio_items DROP COLUMN IF EXISTS target_date;
`;

export default { up, down };

