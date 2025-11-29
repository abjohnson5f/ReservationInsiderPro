/**
 * Price Scraper Service
 * 
 * Scrapes AppointmentTrader and other sources to get REAL pricing data.
 * This data is stored in Neon and serves as the source of truth.
 */

import { tavily } from '@tavily/core';
import pool from '../db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Initialize Tavily client lazily to avoid errors when API key is missing
const getTavilyClient = () => {
  if (!process.env.TAVILY_API_KEY) return null;
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
};

interface ScrapedPrice {
  restaurantName: string;
  price: number;
  priceLow: number;
  priceHigh: number;
  source: string;
  sourceUrl?: string;
}

/**
 * Scrape AppointmentTrader for current listings
 */
export const scrapeAppointmentTrader = async (city: string): Promise<ScrapedPrice[]> => {
  const tvly = getTavilyClient();
  if (!tvly) {
    console.log('[PriceScraper] Tavily API key not configured, skipping AppointmentTrader scrape');
    return [];
  }

  try {
    const response = await tvly.search(
      `site:appointmenttrader.com ${city} restaurant reservation price`, 
      {
        max_results: 20,
        search_depth: 'advanced',
        include_answer: true
      }
    );

    const prices: ScrapedPrice[] = [];
    
    // Parse results for pricing data
    for (const result of response.results || []) {
      // Extract restaurant name and price from title/content
      // AppointmentTrader titles often look like: "Carbone - $450 | AppointmentTrader"
      const priceMatch = result.content?.match(/\$(\d+)/g) || result.title?.match(/\$(\d+)/g);
      
      if (priceMatch && priceMatch.length > 0) {
        // Extract restaurant name (usually before the price or dash)
        const nameMatch = result.title?.split(/[-|]/)[0]?.trim();
        
        if (nameMatch) {
          const extractedPrices = priceMatch.map(p => parseInt(p.replace('$', '')));
          const avgPrice = extractedPrices.reduce((a, b) => a + b, 0) / extractedPrices.length;
          
          prices.push({
            restaurantName: nameMatch,
            price: Math.round(avgPrice),
            priceLow: Math.min(...extractedPrices),
            priceHigh: Math.max(...extractedPrices),
            source: 'AppointmentTrader',
            sourceUrl: result.url
          });
        }
      }
    }

    return prices;
  } catch (error) {
    console.error('AppointmentTrader scrape error:', error);
    return [];
  }
};

/**
 * Get or create a restaurant in the database
 */
export const upsertRestaurant = async (
  name: string,
  city: string,
  data: Partial<{
    cuisine: string;
    description: string;
    estimated_resale_value: number;
    price_low: number;
    price_high: number;
    difficulty_level: string;
    popularity_score: number;
    trend: string;
    data_confidence: string;
    platform: string;
    booking_url: string;
    booking_window_tip: string;
    next_drop_date: string;
    next_drop_time: string;
    drop_timezone: string;
    drop_pattern: string;
  }>
) => {
  const query = `
    INSERT INTO restaurants (
      name, city, cuisine, description,
      estimated_resale_value, price_low, price_high,
      difficulty_level, popularity_score, trend, data_confidence,
      platform, booking_url, booking_window_tip,
      next_drop_date, next_drop_time, drop_timezone, drop_pattern,
      last_price_update, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
    )
    ON CONFLICT (name, city) DO UPDATE SET
      cuisine = COALESCE(EXCLUDED.cuisine, restaurants.cuisine),
      description = COALESCE(EXCLUDED.description, restaurants.description),
      estimated_resale_value = COALESCE(EXCLUDED.estimated_resale_value, restaurants.estimated_resale_value),
      price_low = COALESCE(EXCLUDED.price_low, restaurants.price_low),
      price_high = COALESCE(EXCLUDED.price_high, restaurants.price_high),
      difficulty_level = COALESCE(EXCLUDED.difficulty_level, restaurants.difficulty_level),
      popularity_score = COALESCE(EXCLUDED.popularity_score, restaurants.popularity_score),
      trend = COALESCE(EXCLUDED.trend, restaurants.trend),
      data_confidence = COALESCE(EXCLUDED.data_confidence, restaurants.data_confidence),
      platform = COALESCE(EXCLUDED.platform, restaurants.platform),
      booking_url = COALESCE(EXCLUDED.booking_url, restaurants.booking_url),
      booking_window_tip = COALESCE(EXCLUDED.booking_window_tip, restaurants.booking_window_tip),
      next_drop_date = COALESCE(EXCLUDED.next_drop_date, restaurants.next_drop_date),
      next_drop_time = COALESCE(EXCLUDED.next_drop_time, restaurants.next_drop_time),
      drop_timezone = COALESCE(EXCLUDED.drop_timezone, restaurants.drop_timezone),
      drop_pattern = COALESCE(EXCLUDED.drop_pattern, restaurants.drop_pattern),
      last_price_update = NOW(),
      updated_at = NOW()
    RETURNING *;
  `;

  if (!pool) {
    console.warn('[PriceScraper] Database not configured, skipping upsert');
    return null;
  }

  const result = await pool.query(query, [
    name, city,
    data.cuisine || null,
    data.description || null,
    data.estimated_resale_value || 0,
    data.price_low || null,
    data.price_high || null,
    data.difficulty_level || 'Medium',
    data.popularity_score || 50,
    data.trend || 'STABLE',
    data.data_confidence || 'Medium',
    data.platform || null,
    data.booking_url || null,
    data.booking_window_tip || null,
    data.next_drop_date || null,
    data.next_drop_time || null,
    data.drop_timezone || 'America/New_York',
    data.drop_pattern || null
  ]);

  return result.rows[0];
};

/**
 * Record a price point in history (for trend charts)
 */
export const recordPriceHistory = async (
  restaurantId: number,
  price: number,
  priceLow: number | null,
  priceHigh: number | null,
  source: string,
  sourceUrl?: string
) => {
  const query = `
    INSERT INTO price_history (restaurant_id, price, price_low, price_high, source, source_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  
  if (!pool) {
    console.warn('[PriceScraper] Database not configured, skipping price history');
    return null;
  }

  const result = await pool.query(query, [restaurantId, price, priceLow, priceHigh, source, sourceUrl]);
  return result.rows[0];
};

/**
 * Get restaurants for a city from the database
 */
export const getRestaurantsByCity = async (city: string) => {
  const query = `
    SELECT 
      id,
      name,
      city,
      cuisine,
      description,
      estimated_resale_value as "estimatedResaleValue",
      price_low as "priceLow",
      price_high as "priceHigh",
      difficulty_level as "difficultyLevel",
      popularity_score as "popularityScore",
      trend,
      data_confidence as "dataConfidence",
      platform,
      booking_url as "bookingUrl",
      booking_window_tip as "bookingWindowTip",
      next_drop_date as "nextDropDate",
      next_drop_time as "nextDropTime",
      drop_timezone as "dropTimezone",
      drop_pattern as "dropPattern",
      last_price_update as "lastPriceUpdate"
    FROM restaurants
    WHERE LOWER(city) = LOWER($1)
    ORDER BY estimated_resale_value DESC
    LIMIT 10;
  `;

  if (!pool) {
    console.warn('[PriceScraper] Database not configured, returning empty results');
    return [];
  }

  const result = await pool.query(query, [city]);
  return result.rows;
};

/**
 * Get price history for trend chart (last 7 days)
 */
export const getPriceHistory = async (restaurantId: number, days: number = 7) => {
  const query = `
    SELECT 
      DATE(scanned_at) as day,
      AVG(price) as value,
      COUNT(*) as volume
    FROM price_history
    WHERE restaurant_id = $1
      AND scanned_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(scanned_at)
    ORDER BY day ASC;
  `;

  if (!pool) {
    console.warn('[PriceScraper] Database not configured, returning empty history');
    return [];
  }

  const result = await pool.query(query, [restaurantId]);
  return result.rows;
};

/**
 * Full price update job - scrapes and updates all restaurants for a city
 */
export const runPriceUpdate = async (city: string) => {
  console.log(`[PriceScraper] Starting price update for ${city}...`);
  
  try {
    // 1. Scrape AppointmentTrader
    const scrapedPrices = await scrapeAppointmentTrader(city);
    console.log(`[PriceScraper] Found ${scrapedPrices.length} prices from AppointmentTrader`);

    // 2. Update each restaurant in the database
    for (const scraped of scrapedPrices) {
      const restaurant = await upsertRestaurant(scraped.restaurantName, city, {
        estimated_resale_value: scraped.price,
        price_low: scraped.priceLow,
        price_high: scraped.priceHigh,
        data_confidence: 'High' // Scraped data = high confidence
      });

      // 3. Record in price history for trends
      await recordPriceHistory(
        restaurant.id,
        scraped.price,
        scraped.priceLow,
        scraped.priceHigh,
        scraped.source,
        scraped.sourceUrl
      );
    }

    console.log(`[PriceScraper] Price update complete for ${city}`);
    return { success: true, updated: scrapedPrices.length };
  } catch (error) {
    console.error(`[PriceScraper] Error updating prices for ${city}:`, error);
    return { success: false, error };
  }
};

/**
 * Seed initial restaurant data (run once to populate DB)
 */
export const seedRestaurants = async () => {
  const seedData = [
    // New York City
    { name: "Rao's", city: "New York City", cuisine: "Italian", difficulty_level: "Impossible", estimated_resale_value: 750, price_low: 500, price_high: 1000, popularity_score: 99, description: "Legendary status, tables owned by regulars. Best bet is befriending a regular.", platform: "Phone Only", drop_pattern: "No public reservations" },
    { name: "Carbone", city: "New York City", cuisine: "Italian-American", difficulty_level: "High", estimated_resale_value: 500, price_low: 350, price_high: 700, popularity_score: 95, description: "Classic Italian-American in Greenwich Village. Prime slots gone in seconds.", platform: "Resy", booking_window_tip: "Resy @ 10AM, 30 days out", drop_pattern: "Daily at 10:00 AM EST, 30 days in advance" },
    { name: "Don Angie", city: "New York City", cuisine: "Italian", difficulty_level: "High", estimated_resale_value: 350, price_low: 250, price_high: 500, popularity_score: 90, description: "Creative Italian in West Village. Famous pinwheel lasagna.", platform: "Resy", booking_window_tip: "Resy @ 10AM", drop_pattern: "Daily at 10:00 AM EST" },
    { name: "4 Charles Prime Rib", city: "New York City", cuisine: "Steakhouse", difficulty_level: "High", estimated_resale_value: 600, price_low: 400, price_high: 850, popularity_score: 92, description: "Intimate West Village steakhouse. Prime dinner slots disappear instantly.", platform: "Resy", booking_window_tip: "Resy @ 10AM", drop_pattern: "Daily at 10:00 AM EST" },
    { name: "Tatiana by Kwame Onwuachi", city: "New York City", cuisine: "Afro-Caribbean", difficulty_level: "High", estimated_resale_value: 400, price_low: 300, price_high: 550, popularity_score: 94, description: "Afro-Caribbean cuisine in Lincoln Center. Books solid within seconds.", platform: "Resy", booking_window_tip: "Resy @ 12PM", drop_pattern: "Monthly on 1st at 12:00 PM EST" },
    { name: "Atomix", city: "New York City", cuisine: "Korean Fine Dining", difficulty_level: "High", estimated_resale_value: 450, price_low: 350, price_high: 600, popularity_score: 93, description: "Two Michelin stars, voted eighth best restaurant in the world.", platform: "Tock", booking_window_tip: "Tock prepaid", drop_pattern: "Monthly release" },
    
    // Los Angeles
    { name: "Hayato", city: "Los Angeles", cuisine: "Japanese Kaiseki", difficulty_level: "Impossible", estimated_resale_value: 800, price_low: 600, price_high: 1200, popularity_score: 98, description: "Intimate kaiseki in a strip mall. 8 seats, months-long waitlist.", platform: "Email Only", drop_pattern: "Email waitlist only" },
    { name: "n/naka", city: "Los Angeles", cuisine: "Japanese", difficulty_level: "High", estimated_resale_value: 500, price_low: 400, price_high: 700, popularity_score: 95, description: "Modern kaiseki from Chef Niki Nakayama. Two Michelin stars.", platform: "Tock", booking_window_tip: "Tock @ 10AM PST", drop_pattern: "Monthly on 15th at 10:00 AM PST" },
    { name: "Sushi Ginza Onodera", city: "Los Angeles", cuisine: "Sushi", difficulty_level: "High", estimated_resale_value: 400, price_low: 300, price_high: 550, popularity_score: 88, description: "Omakase from Tokyo-trained chefs. Counter seats most coveted.", platform: "Phone/Tock" },
    
    // Miami
    { name: "Carbone Miami", city: "Miami", cuisine: "Italian-American", difficulty_level: "High", estimated_resale_value: 450, price_low: 300, price_high: 600, popularity_score: 94, description: "Major Food Group's Miami outpost. Celebrity hotspot.", platform: "Resy", booking_window_tip: "Resy @ 10AM", drop_pattern: "Daily at 10:00 AM EST" },
    { name: "Gekko", city: "Miami", cuisine: "Japanese Steakhouse", difficulty_level: "High", estimated_resale_value: 350, price_low: 250, price_high: 500, popularity_score: 90, description: "Bad Bunny's Japanese steakhouse. Impossible weekend tables.", platform: "Resy" },
    
    // London
    { name: "The Ledbury", city: "London", cuisine: "Modern British", difficulty_level: "High", estimated_resale_value: 300, price_low: 200, price_high: 450, popularity_score: 92, description: "Two Michelin stars in Notting Hill. Brett Graham's flagship.", platform: "Phone/Website" },
    { name: "Sketch (Lecture Room)", city: "London", cuisine: "French", difficulty_level: "Medium", estimated_resale_value: 200, price_low: 150, price_high: 300, popularity_score: 85, description: "Three Michelin stars. Iconic pink room.", platform: "Website" },
    
    // Paris
    { name: "Septime", city: "Paris", cuisine: "Modern French", difficulty_level: "High", estimated_resale_value: 250, price_low: 180, price_high: 350, popularity_score: 93, description: "Neo-bistro pioneer. One Michelin star. Books out instantly.", platform: "Phone" },
    { name: "Le Comptoir du Panthéon", city: "Paris", cuisine: "French Bistro", difficulty_level: "Medium", estimated_resale_value: 150, price_low: 100, price_high: 220, popularity_score: 80, description: "Classic bistro near the Panthéon. Locals' favorite.", platform: "Phone" }
  ];

  console.log('[Seed] Starting restaurant seed...');
  
  for (const restaurant of seedData) {
    try {
      await upsertRestaurant(restaurant.name, restaurant.city, {
        cuisine: restaurant.cuisine,
        description: restaurant.description,
        estimated_resale_value: restaurant.estimated_resale_value,
        price_low: restaurant.price_low,
        price_high: restaurant.price_high,
        difficulty_level: restaurant.difficulty_level,
        popularity_score: restaurant.popularity_score,
        platform: restaurant.platform,
        booking_window_tip: restaurant.booking_window_tip,
        drop_pattern: restaurant.drop_pattern,
        data_confidence: 'High'
      });
      console.log(`[Seed] Upserted: ${restaurant.name}`);
    } catch (error) {
      console.error(`[Seed] Error upserting ${restaurant.name}:`, error);
    }
  }

  console.log('[Seed] Restaurant seed complete!');
};








