/**
 * Dynamic Pricing Engine
 * 
 * Analyzes market data to suggest optimal listing prices for AppointmentTrader.
 * Factors: restaurant tier, day of week, party size, time slot, historical sales
 */

import pool from '../db';

interface PricingFactors {
  restaurantName: string;
  platform: string;
  reservationDate: string;  // ISO date
  reservationTime: string;  // HH:MM
  partySize: number;
  city?: string;
}

interface PriceSuggestion {
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    basePrice: number;
    dayOfWeekMultiplier: number;
    timePremium: number;
    partySizePremium: number;
    demandMultiplier: number;
    tierMultiplier: number;
  };
  reasoning: string[];
}

// Restaurant tiers based on difficulty and demand
const RESTAURANT_TIERS: Record<string, { tier: number; basePrice: number }> = {
  // Tier 5: Ultra-rare (Impossible to book)
  'Carbone': { tier: 5, basePrice: 200 },
  '4 Charles Prime Rib': { tier: 5, basePrice: 250 },
  "Rao's": { tier: 5, basePrice: 300 },
  'Le Bernardin': { tier: 5, basePrice: 200 },
  'Polo Bar': { tier: 5, basePrice: 175 },
  
  // Tier 4: Very difficult
  'Don Angie': { tier: 4, basePrice: 150 },
  'Lilia': { tier: 4, basePrice: 125 },
  'I Sodi': { tier: 4, basePrice: 100 },
  'Via Carota': { tier: 4, basePrice: 100 },
  'Dhamaka': { tier: 4, basePrice: 100 },
  'Cote': { tier: 4, basePrice: 125 },
  
  // Tier 3: Difficult
  'Torrisi': { tier: 3, basePrice: 100 },
  'Tatiana': { tier: 3, basePrice: 80 },
  'Double Chicken Please': { tier: 3, basePrice: 75 },
  'Le Rock': { tier: 3, basePrice: 75 },
  'Forsythia': { tier: 3, basePrice: 70 },
  
  // Tier 2: Moderate difficulty
  'Balthazar': { tier: 2, basePrice: 50 },
  'Pastis': { tier: 2, basePrice: 50 },
  'Cafe Lola': { tier: 2, basePrice: 40 },
  
  // Tier 1: Easier but valuable
  'default': { tier: 1, basePrice: 35 },
};

// Day of week multipliers (weekends are premium)
const DAY_MULTIPLIERS: Record<number, number> = {
  0: 1.3,   // Sunday
  1: 0.8,   // Monday
  2: 0.85,  // Tuesday
  3: 0.9,   // Wednesday
  4: 1.0,   // Thursday
  5: 1.4,   // Friday
  6: 1.5,   // Saturday
};

// Time slot premiums
const getTimePremium = (time: string): number => {
  const hour = parseInt(time.split(':')[0]);
  
  // Prime dinner time (7-8 PM)
  if (hour >= 19 && hour <= 20) return 1.3;
  // Good dinner time (6-7 PM, 8-9 PM)
  if ((hour >= 18 && hour < 19) || (hour > 20 && hour <= 21)) return 1.15;
  // Late dinner (9+ PM)
  if (hour > 21) return 1.0;
  // Early dinner (5-6 PM)
  if (hour >= 17 && hour < 18) return 0.9;
  // Lunch (11 AM - 2 PM)
  if (hour >= 11 && hour <= 14) return 0.7;
  // Off-peak
  return 0.6;
};

// Party size premium (2-tops are standard, larger is premium)
const getPartySizePremium = (size: number): number => {
  if (size <= 2) return 1.0;
  if (size === 3) return 1.1;
  if (size === 4) return 1.25;
  if (size === 5) return 1.4;
  if (size >= 6) return 1.6;
  return 1.0;
};

class PricingEngine {
  
  /**
   * Get suggested price for a reservation
   */
  async getSuggestedPrice(factors: PricingFactors): Promise<PriceSuggestion> {
    const reasoning: string[] = [];
    
    // Get restaurant tier
    const tierInfo = RESTAURANT_TIERS[factors.restaurantName] || RESTAURANT_TIERS['default'];
    reasoning.push(`Restaurant tier: ${tierInfo.tier}/5 (base: $${tierInfo.basePrice})`);
    
    // Day of week
    const date = new Date(factors.reservationDate);
    const dayOfWeek = date.getDay();
    const dayMultiplier = DAY_MULTIPLIERS[dayOfWeek];
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    reasoning.push(`${dayName} multiplier: ${dayMultiplier}x`);
    
    // Time premium
    const timePremium = getTimePremium(factors.reservationTime);
    reasoning.push(`Time (${factors.reservationTime}) premium: ${timePremium}x`);
    
    // Party size
    const partySizePremium = getPartySizePremium(factors.partySize);
    reasoning.push(`Party size (${factors.partySize}) premium: ${partySizePremium}x`);
    
    // Demand multiplier from historical data
    const demandMultiplier = await this.getDemandMultiplier(factors.restaurantName, factors.reservationDate);
    reasoning.push(`Demand multiplier: ${demandMultiplier}x`);
    
    // Calculate price
    const calculatedPrice = tierInfo.basePrice 
      * dayMultiplier 
      * timePremium 
      * partySizePremium 
      * demandMultiplier;
    
    // Round to nearest $5
    const suggestedPrice = Math.round(calculatedPrice / 5) * 5;
    
    // Calculate range
    const minPrice = Math.round(suggestedPrice * 0.75 / 5) * 5;
    const maxPrice = Math.round(suggestedPrice * 1.35 / 5) * 5;
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (RESTAURANT_TIERS[factors.restaurantName]) {
      confidence = 'high';
    } else if (demandMultiplier !== 1.0) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    return {
      suggestedPrice,
      minPrice,
      maxPrice,
      confidence,
      factors: {
        basePrice: tierInfo.basePrice,
        dayOfWeekMultiplier: dayMultiplier,
        timePremium,
        partySizePremium,
        demandMultiplier,
        tierMultiplier: tierInfo.tier * 0.2 + 0.6,
      },
      reasoning,
    };
  }
  
  /**
   * Get demand multiplier from historical sales data
   */
  private async getDemandMultiplier(restaurantName: string, date: string): Promise<number> {
    if (!pool) return 1.0;
    
    try {
      const client = await pool.connect();
      try {
        // Check if we have historical sales for this restaurant
        const result = await client.query(`
          SELECT 
            AVG(sale_price / NULLIF(listing_price, 0)) as price_ratio,
            COUNT(*) as sales_count
          FROM transfers
          WHERE restaurant_name = $1
            AND status IN ('SOLD', 'COMPLETED', 'TRANSFERRED')
            AND sale_price IS NOT NULL
            AND listing_price IS NOT NULL
        `, [restaurantName]);
        
        if (result.rows[0]?.sales_count > 0) {
          const priceRatio = parseFloat(result.rows[0].price_ratio) || 1.0;
          // If people are paying above listing, demand is high
          return Math.min(Math.max(priceRatio, 0.8), 1.5);
        }
        
        return 1.0;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[PricingEngine] Error getting demand multiplier:', error);
      return 1.0;
    }
  }
  
  /**
   * Get pricing analytics for dashboard
   */
  async getPricingAnalytics(): Promise<{
    avgSalePrice: number;
    avgListingPrice: number;
    topRestaurants: Array<{ name: string; avgPrice: number; salesCount: number }>;
    priceByDayOfWeek: Array<{ day: string; avgPrice: number }>;
  }> {
    if (!pool) {
      return {
        avgSalePrice: 0,
        avgListingPrice: 0,
        topRestaurants: [],
        priceByDayOfWeek: [],
      };
    }
    
    const client = await pool.connect();
    try {
      // Overall averages
      const avgResult = await client.query(`
        SELECT 
          AVG(sale_price) as avg_sale,
          AVG(listing_price) as avg_listing
        FROM transfers
        WHERE status IN ('SOLD', 'COMPLETED', 'TRANSFERRED')
      `);
      
      // Top restaurants by sales
      const topResult = await client.query(`
        SELECT 
          restaurant_name,
          AVG(sale_price) as avg_price,
          COUNT(*) as sales_count
        FROM transfers
        WHERE status IN ('SOLD', 'COMPLETED', 'TRANSFERRED')
          AND sale_price IS NOT NULL
        GROUP BY restaurant_name
        ORDER BY sales_count DESC, avg_price DESC
        LIMIT 10
      `);
      
      // Price by day of week
      const dayResult = await client.query(`
        SELECT 
          TO_CHAR(reservation_date, 'Day') as day_name,
          EXTRACT(DOW FROM reservation_date) as day_num,
          AVG(sale_price) as avg_price
        FROM transfers
        WHERE status IN ('SOLD', 'COMPLETED', 'TRANSFERRED')
          AND sale_price IS NOT NULL
        GROUP BY day_name, day_num
        ORDER BY day_num
      `);
      
      return {
        avgSalePrice: parseFloat(avgResult.rows[0]?.avg_sale) || 0,
        avgListingPrice: parseFloat(avgResult.rows[0]?.avg_listing) || 0,
        topRestaurants: topResult.rows.map(r => ({
          name: r.restaurant_name,
          avgPrice: parseFloat(r.avg_price),
          salesCount: parseInt(r.sales_count),
        })),
        priceByDayOfWeek: dayResult.rows.map(r => ({
          day: r.day_name.trim(),
          avgPrice: parseFloat(r.avg_price),
        })),
      };
    } finally {
      client.release();
    }
  }
  
  /**
   * Add or update restaurant tier
   */
  addRestaurantTier(name: string, tier: number, basePrice: number): void {
    RESTAURANT_TIERS[name] = { tier, basePrice };
  }
  
  /**
   * Get all known restaurant tiers
   */
  getRestaurantTiers(): Record<string, { tier: number; basePrice: number }> {
    return { ...RESTAURANT_TIERS };
  }
}

export default new PricingEngine();

