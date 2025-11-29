/**
 * Migration: Clients & Concierge Model
 * 
 * Adds support for the concierge booking model where we book
 * reservations ON BEHALF OF clients, with the reservation
 * appearing under their name (not ours).
 * 
 * This is the key to dominating AppointmentTrader:
 * - No flagging risk (our name never appears)
 * - No transfer needed (already in client's name)
 * - Legitimate business model (executive assistant/concierge)
 */

export const up = `
-- =====================================================
-- CLIENTS TABLE
-- Stores clients we book reservations FOR (concierge model)
-- =====================================================
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    
    -- Basic info (required for all bookings)
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    
    -- Business metadata
    company VARCHAR(255),
    notes TEXT,
    vip_level VARCHAR(20) DEFAULT 'standard', -- standard, vip, platinum
    
    -- Platform sync status (for professional profiles)
    -- OpenTable: need to add to "diner list" in professional profile
    -- Resy: concierge accounts can book for anyone
    synced_to_opentable BOOLEAN DEFAULT FALSE,
    synced_to_resy BOOLEAN DEFAULT FALSE,
    opentable_diner_id VARCHAR(255), -- ID in OpenTable's diner list
    
    -- Tracking & Analytics
    total_bookings INTEGER DEFAULT 0,
    successful_bookings INTEGER DEFAULT 0,
    total_revenue NUMERIC(10, 2) DEFAULT 0, -- Total charged for services
    last_booking_date TIMESTAMP,
    
    -- Preferences
    preferred_cuisines TEXT[], -- Array of cuisine preferences
    dietary_restrictions TEXT[],
    preferred_party_size INTEGER DEFAULT 2,
    preferred_time_slot VARCHAR(20), -- 'lunch', 'early_dinner', 'prime_dinner', 'late_dinner'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(email)
);

-- =====================================================
-- UPDATE TRANSFERS TABLE
-- Add concierge booking support
-- =====================================================
DO $$ 
BEGIN
    -- Add booking_type column if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transfers' AND column_name = 'booking_type') THEN
        ALTER TABLE transfers ADD COLUMN booking_type VARCHAR(20) DEFAULT 'standard';
        -- booking_type values:
        -- 'standard' = We book under our identity, then transfer to buyer
        -- 'concierge' = We book under client's name, no transfer needed
        -- 'speculative' = We book speculatively to list on AT
    END IF;
    
    -- Add client_id foreign key if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transfers' AND column_name = 'client_id') THEN
        ALTER TABLE transfers ADD COLUMN client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
    END IF;
    
    -- Add service_fee column for concierge bookings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transfers' AND column_name = 'service_fee') THEN
        ALTER TABLE transfers ADD COLUMN service_fee NUMERIC(10, 2);
    END IF;
    
    -- Add booked_under_name to track whose name is on the reservation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transfers' AND column_name = 'booked_under_name') THEN
        ALTER TABLE transfers ADD COLUMN booked_under_name VARCHAR(255);
    END IF;
END $$;

-- =====================================================
-- CLIENT BOOKING REQUESTS TABLE
-- Queue of client requests for reservations
-- =====================================================
CREATE TABLE IF NOT EXISTS client_booking_requests (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Request details
    restaurant_name VARCHAR(255) NOT NULL,
    platform VARCHAR(50), -- resy, opentable, sevenrooms, tock, or NULL for "any"
    venue_id VARCHAR(255), -- Platform-specific venue ID if known
    
    -- Desired reservation details
    desired_date DATE NOT NULL,
    desired_time VARCHAR(10), -- Preferred time or NULL for "any"
    time_flexibility INTEGER DEFAULT 60, -- Minutes flexibility (+/-)
    party_size INTEGER NOT NULL DEFAULT 2,
    
    -- Special requests
    special_requests TEXT,
    occasion VARCHAR(100), -- birthday, anniversary, business, etc.
    
    -- Pricing
    max_service_fee NUMERIC(10, 2), -- Max the client will pay for our service
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending', 
    -- pending, searching, acquired, failed, cancelled
    
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    acquired_at TIMESTAMP,
    
    -- Result
    transfer_id INTEGER REFERENCES transfers(id),
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP -- Auto-cancel if not fulfilled by this date
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_vip_level ON clients(vip_level);
CREATE INDEX IF NOT EXISTS idx_clients_last_booking ON clients(last_booking_date DESC);

CREATE INDEX IF NOT EXISTS idx_transfers_booking_type ON transfers(booking_type);
CREATE INDEX IF NOT EXISTS idx_transfers_client_id ON transfers(client_id);

CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON client_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_booking_requests_client ON client_booking_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_requests_date ON client_booking_requests(desired_date);

-- =====================================================
-- TRIGGER: Update client stats on booking
-- =====================================================
CREATE OR REPLACE FUNCTION update_client_booking_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.client_id IS NOT NULL AND NEW.status = 'COMPLETED' THEN
        UPDATE clients 
        SET 
            total_bookings = total_bookings + 1,
            successful_bookings = successful_bookings + 1,
            total_revenue = total_revenue + COALESCE(NEW.service_fee, 0),
            last_booking_date = NOW(),
            updated_at = NOW()
        WHERE id = NEW.client_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_client_stats ON transfers;
CREATE TRIGGER trigger_update_client_stats
    AFTER UPDATE ON transfers
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_client_booking_stats();
`;

export const down = `
DROP TRIGGER IF EXISTS trigger_update_client_stats ON transfers;
DROP FUNCTION IF EXISTS update_client_booking_stats();

DROP TABLE IF EXISTS client_booking_requests;
DROP TABLE IF EXISTS clients CASCADE;

ALTER TABLE transfers DROP COLUMN IF EXISTS booking_type;
ALTER TABLE transfers DROP COLUMN IF EXISTS client_id;
ALTER TABLE transfers DROP COLUMN IF EXISTS service_fee;
ALTER TABLE transfers DROP COLUMN IF EXISTS booked_under_name;
`;

