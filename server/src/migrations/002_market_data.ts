/**
 * Migration: Create market_data table with full schema
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

async function migrate() {
  console.log('Running migration: 002_market_data');

  try {
    // Drop and recreate for clean schema
    await pool.query(`
      DROP TABLE IF EXISTS market_data CASCADE;
      
      CREATE TABLE market_data (
        id SERIAL PRIMARY KEY,
        restaurant_name VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        cuisine VARCHAR(100),
        estimated_resale_value INTEGER DEFAULT 0,
        price_low INTEGER DEFAULT 0,
        price_high INTEGER DEFAULT 0,
        difficulty_level VARCHAR(50) DEFAULT 'Medium',
        popularity_score INTEGER DEFAULT 50,
        trend VARCHAR(20) DEFAULT 'STABLE',
        description TEXT,
        booking_window_tip VARCHAR(255),
        data_confidence VARCHAR(20) DEFAULT 'Medium',
        instagram_followers INTEGER,
        instagram_engagement DECIMAL(5,4),
        hype_score INTEGER,
        sources JSONB DEFAULT '[]',
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(restaurant_name, city)
      );
      
      -- Indexes for common queries
      CREATE INDEX idx_market_data_city ON market_data(city);
      CREATE INDEX idx_market_data_hype ON market_data(hype_score DESC NULLS LAST);
      CREATE INDEX idx_market_data_value ON market_data(estimated_resale_value DESC);
      CREATE INDEX idx_market_data_difficulty ON market_data(difficulty_level);
      CREATE INDEX idx_market_data_updated ON market_data(last_updated DESC);
    `);

    console.log('✅ market_data table created successfully');

    // Also ensure portfolio_items has all needed columns
    await pool.query(`
      ALTER TABLE portfolio_items 
        ADD COLUMN IF NOT EXISTS city VARCHAR(100),
        ADD COLUMN IF NOT EXISTS booking_url VARCHAR(500),
        ADD COLUMN IF NOT EXISTS hype_score INTEGER;
    `);

    console.log('✅ portfolio_items columns updated');

  } catch (error: any) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().then(() => {
  console.log('Migration complete');
  process.exit(0);
}).catch(() => {
  process.exit(1);
});


