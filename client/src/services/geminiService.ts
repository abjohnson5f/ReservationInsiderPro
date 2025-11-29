import { Restaurant, MarketInsight, ChartDataPoint, Source } from "../types";

// API endpoints
const V2_API_URL = 'http://localhost:3000/api/v2/market';
const AI_API_URL = 'http://localhost:3000/api/market';

// ==========================================
// TYPES
// ==========================================

export interface FetchOptions {
  limit?: number;
  offset?: number;
  sort?: 'hype_score' | 'estimated_resale_value' | 'difficulty_level' | 'popularity_score';
  order?: 'asc' | 'desc';
  difficulty?: 'Low' | 'Medium' | 'High' | 'Impossible';
  minValue?: number;
  maxValue?: number;
  refresh?: boolean;
}

export interface FetchResult {
  restaurants: Restaurant[];
  total: number;
  source: 'cache' | 'live' | 'database';
}

// ==========================================
// V2 API - Full Pipeline
// ==========================================

/**
 * Scan a city for restaurants (triggers AI + saves to DB)
 */
export const scanCity = async (city: string, options: FetchOptions = {}): Promise<FetchResult> => {
  try {
    const params = new URLSearchParams({
      city,
      limit: String(options.limit || 15),
      refresh: String(options.refresh || false)
    });

    console.log(`[MarketV2] Scanning ${city}...`);
    const response = await fetch(`${V2_API_URL}/scan?${params}`);
    
    if (!response.ok) throw new Error('Scan failed');
    
    const data = await response.json();
    
    // Map database format to frontend format
    const restaurants = data.restaurants.map(mapDbToRestaurant);
    
    console.log(`[MarketV2] Got ${restaurants.length} restaurants from ${data.source}`);
    
    return {
      restaurants,
      total: data.count,
      source: data.source
    };
  } catch (error) {
    console.error("Error scanning city:", error);
    return { restaurants: [], total: 0, source: 'database' };
  }
};

/**
 * List restaurants with filtering/sorting (from DB)
 */
export const listRestaurants = async (options: FetchOptions & { city?: string; cities?: string[] } = {}): Promise<FetchResult> => {
  try {
    const params = new URLSearchParams();
    
    if (options.city) params.set('city', options.city);
    if (options.cities) params.set('cities', options.cities.join(','));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.sort) params.set('sort', options.sort);
    if (options.order) params.set('order', options.order);
    if (options.difficulty) params.set('difficulty', options.difficulty);
    if (options.minValue) params.set('minValue', String(options.minValue));
    if (options.maxValue) params.set('maxValue', String(options.maxValue));

    const response = await fetch(`${V2_API_URL}/list?${params}`);
    
    if (!response.ok) throw new Error('List failed');
    
    const data = await response.json();
    
    return {
      restaurants: data.restaurants.map(mapDbToRestaurant),
      total: data.total,
      source: 'database'
    };
  } catch (error) {
    console.error("Error listing restaurants:", error);
    return { restaurants: [], total: 0, source: 'database' };
  }
};

/**
 * Get available cities
 */
export const getCities = async (): Promise<{ city: string; restaurant_count: number; last_scan: string }[]> => {
  try {
    const response = await fetch(`${V2_API_URL}/cities`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.cities || [];
  } catch (error) {
    console.error("Error fetching cities:", error);
    return [];
  }
};

/**
 * Map database row to frontend Restaurant type
 */
const mapDbToRestaurant = (row: any): Restaurant => ({
  name: row.restaurant_name,
  cuisine: row.cuisine,
  estimatedResaleValue: row.estimated_resale_value,
  priceLow: row.price_low,
  priceHigh: row.price_high,
  difficultyLevel: row.difficulty_level,
  popularityScore: row.popularity_score,
  trend: row.trend,
  description: row.description,
  bookingWindowTip: row.booking_window_tip,
  dataConfidence: row.data_confidence,
  hypeScore: row.hype_score,
  instagramFollowers: row.instagram_followers,
  sources: row.sources || [],
  city: row.city
});

// ==========================================
// LEGACY - For backwards compatibility
// ==========================================

/**
 * Fetch restaurants (legacy - uses V2 scan)
 */
export const fetchTopRestaurants = async (city: string): Promise<Restaurant[]> => {
  const result = await scanCity(city, { limit: 15 });
  return result.restaurants;
};

/**
 * Fetch market insight (strategy text from Gemini, drop times from DB)
 */
export const fetchMarketInsight = async (restaurantName: string, city: string): Promise<MarketInsight | null> => {
  try {
    const response = await fetch(`${AI_API_URL}/insight?restaurant=${encodeURIComponent(restaurantName)}&city=${encodeURIComponent(city)}`);
    if (!response.ok) throw new Error('Failed to fetch insight');
    return await response.json();
  } catch (error) {
    console.error("Error fetching insights:", error);
    return null;
  }
};

/**
 * Fetch trend data - tries database first, falls back to Gemini
 */
export const generateTrendData = async (restaurantName: string, restaurantId?: number): Promise<ChartDataPoint[]> => {
    try {
        // If we have a restaurant ID, try to get real history from DB
        if (restaurantId) {
          const dbResponse = await fetch(`${DB_API_URL}/${restaurantId}/history`);
          if (dbResponse.ok) {
            const dbData = await dbResponse.json();
            if (dbData && dbData.length > 0) {
              console.log(`[Data Source] Using DATABASE for trend data`);
              return dbData;
            }
          }
        }

        // Fallback to Gemini-generated trend data
        const response = await fetch(`${AI_API_URL}/trend?restaurant=${encodeURIComponent(restaurantName)}`);
        if (!response.ok) throw new Error('Failed to fetch trend data');
        return await response.json();
    } catch (error) {
        console.error("Error chart data", error);
        return [];
    }
}