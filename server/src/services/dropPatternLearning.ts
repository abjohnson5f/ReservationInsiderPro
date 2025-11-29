/**
 * Drop Pattern Learning Service
 * 
 * Records and learns from successful acquisition patterns.
 * Tracks: days in advance, drop time, drop day of week, success rate
 */

import pool from '../db';

interface DropPattern {
  id?: number;
  restaurant_name: string;
  platform: string;
  days_in_advance: number;
  drop_time: string;  // HH:MM
  drop_timezone: string;
  drop_day_of_week?: number;  // 0-6 (Sunday-Saturday)
  confidence: number;  // 0-100
  successful_acquisitions: number;
  total_attempts: number;
  last_confirmed: Date;
  notes?: string;
}

interface AcquisitionAttempt {
  restaurantName: string;
  platform: string;
  targetDate: string;
  attemptTime: Date;
  success: boolean;
  confirmationCode?: string;
  error?: string;
}

class DropPatternLearning {
  
  /**
   * Initialize the confirmed_drop_patterns table
   */
  async initTable(): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS confirmed_drop_patterns (
          id SERIAL PRIMARY KEY,
          restaurant_name VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          days_in_advance INTEGER NOT NULL,
          drop_time VARCHAR(10) NOT NULL,
          drop_timezone VARCHAR(50) DEFAULT 'America/New_York',
          drop_day_of_week INTEGER,
          confidence INTEGER DEFAULT 50,
          successful_acquisitions INTEGER DEFAULT 0,
          total_attempts INTEGER DEFAULT 0,
          last_confirmed TIMESTAMP,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(restaurant_name, platform)
        );
        
        CREATE TABLE IF NOT EXISTS acquisition_attempts (
          id SERIAL PRIMARY KEY,
          restaurant_name VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          target_date DATE NOT NULL,
          attempt_time TIMESTAMP NOT NULL,
          success BOOLEAN NOT NULL,
          confirmation_code VARCHAR(255),
          error TEXT,
          identity_id INTEGER REFERENCES booking_identities(id),
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_attempts_restaurant ON acquisition_attempts(restaurant_name);
        CREATE INDEX IF NOT EXISTS idx_attempts_success ON acquisition_attempts(success);
        CREATE INDEX IF NOT EXISTS idx_patterns_restaurant ON confirmed_drop_patterns(restaurant_name);
      `);
      console.log('[DropPatternLearning] Tables initialized');
    } finally {
      client.release();
    }
  }
  
  /**
   * Record an acquisition attempt
   */
  async recordAttempt(attempt: AcquisitionAttempt, identityId?: number): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO acquisition_attempts 
        (restaurant_name, platform, target_date, attempt_time, success, confirmation_code, error, identity_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        attempt.restaurantName,
        attempt.platform,
        attempt.targetDate,
        attempt.attemptTime,
        attempt.success,
        attempt.confirmationCode,
        attempt.error,
        identityId,
      ]);
      
      // If successful, update the pattern
      if (attempt.success) {
        await this.confirmPattern(attempt);
      }
      
      // Update total attempts for pattern
      await this.updatePatternStats(attempt.restaurantName, attempt.platform, attempt.success);
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Confirm/update a drop pattern after successful acquisition
   */
  async confirmPattern(attempt: AcquisitionAttempt): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      const targetDate = new Date(attempt.targetDate);
      const attemptDate = attempt.attemptTime;
      
      // Calculate days in advance
      const daysInAdvance = Math.floor(
        (targetDate.getTime() - attemptDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Get drop time
      const dropTime = attemptDate.toTimeString().slice(0, 5);
      const dropDayOfWeek = attemptDate.getDay();
      
      // Upsert pattern
      await client.query(`
        INSERT INTO confirmed_drop_patterns 
        (restaurant_name, platform, days_in_advance, drop_time, drop_day_of_week, 
         successful_acquisitions, total_attempts, last_confirmed, confidence)
        VALUES ($1, $2, $3, $4, $5, 1, 1, NOW(), 70)
        ON CONFLICT (restaurant_name, platform) 
        DO UPDATE SET
          days_in_advance = CASE 
            WHEN confirmed_drop_patterns.successful_acquisitions >= 3 
            THEN confirmed_drop_patterns.days_in_advance 
            ELSE $3 
          END,
          drop_time = CASE 
            WHEN confirmed_drop_patterns.successful_acquisitions >= 3 
            THEN confirmed_drop_patterns.drop_time 
            ELSE $4 
          END,
          drop_day_of_week = $5,
          successful_acquisitions = confirmed_drop_patterns.successful_acquisitions + 1,
          last_confirmed = NOW(),
          confidence = LEAST(100, confirmed_drop_patterns.confidence + 10),
          updated_at = NOW()
      `, [
        attempt.restaurantName,
        attempt.platform,
        daysInAdvance,
        dropTime,
        dropDayOfWeek,
      ]);
      
      console.log(`[DropPatternLearning] Confirmed pattern: ${attempt.restaurantName} - ${daysInAdvance} days @ ${dropTime}`);
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Update pattern stats (attempts count)
   */
  private async updatePatternStats(restaurantName: string, platform: string, success: boolean): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE confirmed_drop_patterns
        SET 
          total_attempts = total_attempts + 1,
          confidence = CASE 
            WHEN $3 THEN LEAST(100, confidence + 5)
            ELSE GREATEST(10, confidence - 2)
          END,
          updated_at = NOW()
        WHERE restaurant_name = $1 AND platform = $2
      `, [restaurantName, platform, success]);
    } finally {
      client.release();
    }
  }
  
  /**
   * Get known drop pattern for a restaurant
   */
  async getPattern(restaurantName: string, platform?: string): Promise<DropPattern | null> {
    if (!pool) return null;
    
    const client = await pool.connect();
    try {
      const query = platform 
        ? `SELECT * FROM confirmed_drop_patterns WHERE restaurant_name = $1 AND platform = $2`
        : `SELECT * FROM confirmed_drop_patterns WHERE restaurant_name = $1 ORDER BY confidence DESC LIMIT 1`;
      
      const params = platform ? [restaurantName, platform] : [restaurantName];
      const result = await client.query(query, params);
      
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get all known patterns
   */
  async getAllPatterns(): Promise<DropPattern[]> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM confirmed_drop_patterns 
        ORDER BY confidence DESC, successful_acquisitions DESC
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get acquisition history
   */
  async getAcquisitionHistory(limit = 50): Promise<AcquisitionAttempt[]> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          restaurant_name as "restaurantName",
          platform,
          target_date as "targetDate",
          attempt_time as "attemptTime",
          success,
          confirmation_code as "confirmationCode",
          error
        FROM acquisition_attempts 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get success rate stats
   */
  async getSuccessStats(): Promise<{
    totalAttempts: number;
    successfulAttempts: number;
    successRate: number;
    byPlatform: Array<{ platform: string; attempts: number; successes: number; rate: number }>;
    byRestaurant: Array<{ name: string; attempts: number; successes: number; rate: number }>;
  }> {
    if (!pool) {
      return {
        totalAttempts: 0,
        successfulAttempts: 0,
        successRate: 0,
        byPlatform: [],
        byRestaurant: [],
      };
    }
    
    const client = await pool.connect();
    try {
      // Overall stats
      const overallResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes
        FROM acquisition_attempts
      `);
      
      const total = parseInt(overallResult.rows[0]?.total) || 0;
      const successes = parseInt(overallResult.rows[0]?.successes) || 0;
      
      // By platform
      const platformResult = await client.query(`
        SELECT 
          platform,
          COUNT(*) as attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes
        FROM acquisition_attempts
        GROUP BY platform
        ORDER BY attempts DESC
      `);
      
      // By restaurant
      const restaurantResult = await client.query(`
        SELECT 
          restaurant_name as name,
          COUNT(*) as attempts,
          SUM(CASE WHEN success THEN 1 ELSE 0 END) as successes
        FROM acquisition_attempts
        GROUP BY restaurant_name
        ORDER BY attempts DESC
        LIMIT 20
      `);
      
      return {
        totalAttempts: total,
        successfulAttempts: successes,
        successRate: total > 0 ? (successes / total) * 100 : 0,
        byPlatform: platformResult.rows.map(r => ({
          platform: r.platform,
          attempts: parseInt(r.attempts),
          successes: parseInt(r.successes),
          rate: parseInt(r.attempts) > 0 ? (parseInt(r.successes) / parseInt(r.attempts)) * 100 : 0,
        })),
        byRestaurant: restaurantResult.rows.map(r => ({
          name: r.name,
          attempts: parseInt(r.attempts),
          successes: parseInt(r.successes),
          rate: parseInt(r.attempts) > 0 ? (parseInt(r.successes) / parseInt(r.attempts)) * 100 : 0,
        })),
      };
    } finally {
      client.release();
    }
  }
  
  /**
   * Manually add a known drop pattern
   */
  async addPattern(pattern: Omit<DropPattern, 'id'>): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO confirmed_drop_patterns 
        (restaurant_name, platform, days_in_advance, drop_time, drop_timezone, 
         drop_day_of_week, confidence, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (restaurant_name, platform) 
        DO UPDATE SET
          days_in_advance = $3,
          drop_time = $4,
          drop_timezone = $5,
          drop_day_of_week = $6,
          confidence = $7,
          notes = $8,
          updated_at = NOW()
      `, [
        pattern.restaurant_name,
        pattern.platform,
        pattern.days_in_advance,
        pattern.drop_time,
        pattern.drop_timezone || 'America/New_York',
        pattern.drop_day_of_week,
        pattern.confidence || 50,
        pattern.notes,
      ]);
    } finally {
      client.release();
    }
  }
}

export default new DropPatternLearning();

