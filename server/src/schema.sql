-- Migration 001: Initial Schema

-- 1. Portfolio Items (The "Assets")
CREATE TABLE IF NOT EXISTS portfolio_items (
    id TEXT PRIMARY KEY, -- Keeping string ID to be compatible with current frontend UUIDs
    restaurant_name TEXT NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    guests INTEGER DEFAULT 2,
    cost_basis NUMERIC(10, 2) DEFAULT 0,
    list_price NUMERIC(10, 2) DEFAULT 0,
    sold_price NUMERIC(10, 2),
    platform TEXT DEFAULT 'Resy',
    status TEXT DEFAULT 'WATCHING', -- 'WATCHING', 'ACQUIRED', 'LISTED', 'PENDING', 'SOLD', 'TRANSFERRED'
    guest_name TEXT,
    drop_time TIME, -- DEPRECATED: The "Sniper" target time (e.g. 09:00:00)
    next_drop_date DATE, -- Enhanced: Full calendar date of next drop
    next_drop_time TIME, -- Enhanced: Time of drop
    drop_timezone TEXT, -- Enhanced: IANA timezone (e.g. 'America/Los_Angeles')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Restaurants (Source of Truth for Pricing)
-- This is the canonical data displayed on the frontend
CREATE TABLE IF NOT EXISTS restaurants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    cuisine TEXT,
    description TEXT,
    
    -- Pricing (updated daily by scraper)
    estimated_resale_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_low NUMERIC(10, 2),
    price_high NUMERIC(10, 2),
    
    -- Metadata
    difficulty_level TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High', 'Impossible'
    popularity_score INTEGER DEFAULT 50,
    trend TEXT DEFAULT 'STABLE', -- 'UP', 'DOWN', 'STABLE'
    data_confidence TEXT DEFAULT 'Medium', -- 'Low', 'Medium', 'High'
    
    -- Booking Info
    platform TEXT, -- 'Resy', 'Tock', 'OpenTable'
    booking_url TEXT,
    booking_window_tip TEXT,
    
    -- Drop Schedule (for Sniper)
    next_drop_date DATE,
    next_drop_time TIME,
    drop_timezone TEXT DEFAULT 'America/New_York',
    drop_pattern TEXT, -- Human readable: "Monthly on 1st at 10 AM PST"
    
    -- Timestamps
    last_price_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(name, city)
);

-- 3. Price History (For 7-Day Trend Charts)
-- Each scan creates a record, enabling real trend analysis
CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    price_low NUMERIC(10, 2),
    price_high NUMERIC(10, 2),
    source TEXT, -- 'AppointmentTrader', 'Reddit', 'Manual'
    source_url TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Market Data (Legacy - keeping for backwards compatibility)
CREATE TABLE IF NOT EXISTS market_data (
    id SERIAL PRIMARY KEY,
    restaurant_name TEXT NOT NULL,
    city TEXT NOT NULL,
    check_date DATE NOT NULL,
    check_time TIME,
    price NUMERIC(10, 2),
    source TEXT,
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON portfolio_items(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants(city);
CREATE INDEX IF NOT EXISTS idx_restaurants_name_city ON restaurants(name, city);
CREATE INDEX IF NOT EXISTS idx_price_history_restaurant ON price_history(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(scanned_at);
CREATE INDEX IF NOT EXISTS idx_market_restaurant ON market_data(restaurant_name);

