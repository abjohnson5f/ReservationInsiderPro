/**
 * Competition Monitor Service
 * 
 * Tracks other AppointmentTrader sellers and their listings.
 * Provides insights for competitive pricing and timing.
 */

import pool from '../db';

interface CompetitorListing {
  id?: number;
  seller_name: string;
  restaurant_name: string;
  listing_price: number;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  platform?: string;
  listing_url?: string;
  status: 'active' | 'sold' | 'expired';
  first_seen: Date;
  last_seen: Date;
  days_listed?: number;
}

interface CompetitorStats {
  sellerName: string;
  totalListings: number;
  avgPrice: number;
  avgDaysToSell: number;
  topRestaurants: string[];
}

class CompetitionMonitor {
  
  /**
   * Initialize the competitor_listings table
   */
  async initTable(): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS competitor_listings (
          id SERIAL PRIMARY KEY,
          seller_name VARCHAR(255) NOT NULL,
          restaurant_name VARCHAR(255) NOT NULL,
          listing_price NUMERIC(10, 2),
          reservation_date DATE,
          reservation_time VARCHAR(10),
          party_size INTEGER,
          platform VARCHAR(50),
          listing_url TEXT,
          status VARCHAR(20) DEFAULT 'active',
          first_seen TIMESTAMP DEFAULT NOW(),
          last_seen TIMESTAMP DEFAULT NOW(),
          days_listed INTEGER,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_competitor_seller ON competitor_listings(seller_name);
        CREATE INDEX IF NOT EXISTS idx_competitor_restaurant ON competitor_listings(restaurant_name);
        CREATE INDEX IF NOT EXISTS idx_competitor_status ON competitor_listings(status);
      `);
      console.log('[CompetitionMonitor] Tables initialized');
    } finally {
      client.release();
    }
  }
  
  /**
   * Add or update a competitor listing
   */
  async trackListing(listing: Omit<CompetitorListing, 'id' | 'first_seen' | 'last_seen'>): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      // Check if listing already exists
      const existing = await client.query(`
        SELECT id, first_seen FROM competitor_listings
        WHERE seller_name = $1 
          AND restaurant_name = $2 
          AND reservation_date = $3
          AND status = 'active'
      `, [listing.seller_name, listing.restaurant_name, listing.reservation_date]);
      
      if (existing.rows.length > 0) {
        // Update existing
        await client.query(`
          UPDATE competitor_listings
          SET 
            listing_price = $1,
            last_seen = NOW(),
            days_listed = EXTRACT(DAY FROM NOW() - first_seen),
            updated_at = NOW()
          WHERE id = $2
        `, [listing.listing_price, existing.rows[0].id]);
      } else {
        // Insert new
        await client.query(`
          INSERT INTO competitor_listings 
          (seller_name, restaurant_name, listing_price, reservation_date, 
           reservation_time, party_size, platform, listing_url, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          listing.seller_name,
          listing.restaurant_name,
          listing.listing_price,
          listing.reservation_date,
          listing.reservation_time,
          listing.party_size,
          listing.platform,
          listing.listing_url,
          listing.status || 'active',
        ]);
      }
    } finally {
      client.release();
    }
  }
  
  /**
   * Mark a listing as sold or expired
   */
  async updateListingStatus(id: number, status: 'sold' | 'expired'): Promise<void> {
    if (!pool) return;
    
    const client = await pool.connect();
    try {
      await client.query(`
        UPDATE competitor_listings
        SET 
          status = $1,
          days_listed = EXTRACT(DAY FROM NOW() - first_seen),
          updated_at = NOW()
        WHERE id = $2
      `, [status, id]);
    } finally {
      client.release();
    }
  }
  
  /**
   * Get active competitor listings for a restaurant
   */
  async getListingsForRestaurant(restaurantName: string): Promise<CompetitorListing[]> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM competitor_listings
        WHERE restaurant_name ILIKE $1
          AND status = 'active'
        ORDER BY listing_price ASC
      `, [`%${restaurantName}%`]);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get competitor statistics
   */
  async getCompetitorStats(): Promise<CompetitorStats[]> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        WITH seller_stats AS (
          SELECT 
            seller_name,
            COUNT(*) as total_listings,
            AVG(listing_price) as avg_price,
            AVG(CASE WHEN status = 'sold' THEN days_listed ELSE NULL END) as avg_days_to_sell
          FROM competitor_listings
          GROUP BY seller_name
        ),
        seller_restaurants AS (
          SELECT 
            seller_name,
            ARRAY_AGG(DISTINCT restaurant_name ORDER BY restaurant_name) as top_restaurants
          FROM (
            SELECT seller_name, restaurant_name, COUNT(*) as cnt
            FROM competitor_listings
            GROUP BY seller_name, restaurant_name
            ORDER BY cnt DESC
          ) sub
          GROUP BY seller_name
        )
        SELECT 
          s.seller_name,
          s.total_listings,
          s.avg_price,
          s.avg_days_to_sell,
          r.top_restaurants
        FROM seller_stats s
        LEFT JOIN seller_restaurants r ON s.seller_name = r.seller_name
        ORDER BY s.total_listings DESC
        LIMIT 20
      `);
      
      return result.rows.map(r => ({
        sellerName: r.seller_name,
        totalListings: parseInt(r.total_listings),
        avgPrice: parseFloat(r.avg_price) || 0,
        avgDaysToSell: parseFloat(r.avg_days_to_sell) || 0,
        topRestaurants: r.top_restaurants || [],
      }));
    } finally {
      client.release();
    }
  }
  
  /**
   * Get market pricing for a restaurant
   */
  async getMarketPricing(restaurantName: string): Promise<{
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    activeListings: number;
    recentSales: number;
  }> {
    if (!pool) {
      return { avgPrice: 0, minPrice: 0, maxPrice: 0, activeListings: 0, recentSales: 0 };
    }
    
    const client = await pool.connect();
    try {
      const activeResult = await client.query(`
        SELECT 
          AVG(listing_price) as avg_price,
          MIN(listing_price) as min_price,
          MAX(listing_price) as max_price,
          COUNT(*) as active_count
        FROM competitor_listings
        WHERE restaurant_name ILIKE $1
          AND status = 'active'
      `, [`%${restaurantName}%`]);
      
      const salesResult = await client.query(`
        SELECT COUNT(*) as sales_count
        FROM competitor_listings
        WHERE restaurant_name ILIKE $1
          AND status = 'sold'
          AND updated_at > NOW() - INTERVAL '30 days'
      `, [`%${restaurantName}%`]);
      
      return {
        avgPrice: parseFloat(activeResult.rows[0]?.avg_price) || 0,
        minPrice: parseFloat(activeResult.rows[0]?.min_price) || 0,
        maxPrice: parseFloat(activeResult.rows[0]?.max_price) || 0,
        activeListings: parseInt(activeResult.rows[0]?.active_count) || 0,
        recentSales: parseInt(salesResult.rows[0]?.sales_count) || 0,
      };
    } finally {
      client.release();
    }
  }
  
  /**
   * Get all active listings
   */
  async getAllActiveListings(): Promise<CompetitorListing[]> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM competitor_listings
        WHERE status = 'active'
        ORDER BY first_seen DESC
      `);
      return result.rows;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get price history for a restaurant
   */
  async getPriceHistory(restaurantName: string): Promise<Array<{
    date: string;
    avgPrice: number;
    listings: number;
  }>> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          DATE(first_seen) as date,
          AVG(listing_price) as avg_price,
          COUNT(*) as listings
        FROM competitor_listings
        WHERE restaurant_name ILIKE $1
        GROUP BY DATE(first_seen)
        ORDER BY date DESC
        LIMIT 30
      `, [`%${restaurantName}%`]);
      
      return result.rows.map(r => ({
        date: r.date,
        avgPrice: parseFloat(r.avg_price),
        listings: parseInt(r.listings),
      }));
    } finally {
      client.release();
    }
  }
}

export default new CompetitionMonitor();

