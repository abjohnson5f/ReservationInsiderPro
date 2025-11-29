/**
 * Market V2 Routes - Full Data Pipeline
 * 
 * - Fetches data from Gemini + Tavily + Apify
 * - Saves to database
 * - Supports pagination, filtering, sorting
 * - Multi-city support
 */

import { Router } from 'express';
import { GoogleGenAI } from "@google/genai";
import { tavily } from '@tavily/core';
import { ApifyClient } from 'apify-client';
import pool from '../db';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const router = Router();

// Initialize clients lazily to avoid errors when API keys are missing
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const getTavilyClient = () => {
  if (!process.env.TAVILY_API_KEY) return null;
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
};

const getApifyClient = () => {
  if (!process.env.APIFY_API_TOKEN) return null;
  return new ApifyClient({ token: process.env.APIFY_API_TOKEN });
};

// ===========================================
// TYPES
// ===========================================

interface MarketDataRow {
  id?: string;
  restaurant_name: string;
  city: string;
  cuisine: string;
  estimated_resale_value: number;
  price_low: number;
  price_high: number;
  difficulty_level: string;
  popularity_score: number;
  trend: string;
  description: string;
  booking_window_tip: string;
  data_confidence: string;
  instagram_followers?: number;
  instagram_engagement?: number;
  hype_score?: number;
  sources: any;
  last_updated: Date;
}

// ===========================================
// HELPER: Parse JSON from Gemini
// ===========================================

const parseJsonFromText = <T>(text: string): T | null => {
  try {
    let cleanText = text.replace(/```json\n?|\n?```/g, '');
    const firstBracket = cleanText.indexOf('{');
    const firstSquare = cleanText.indexOf('[');
    
    let startIndex = -1;
    let endIndex = -1;

    if (firstSquare !== -1 && (firstBracket === -1 || firstSquare < firstBracket)) {
      startIndex = firstSquare;
      endIndex = cleanText.lastIndexOf(']') + 1;
    } else if (firstBracket !== -1) {
      startIndex = firstBracket;
      endIndex = cleanText.lastIndexOf('}') + 1;
    }

    if (startIndex !== -1 && endIndex !== -1) {
      cleanText = cleanText.substring(startIndex, endIndex);
      return JSON.parse(cleanText) as T;
    }
    
    return JSON.parse(cleanText) as T;
  } catch (e) {
    console.error("JSON Parsing failed", e);
    return null;
  }
};

// ===========================================
// HELPER: Fetch Instagram hype data
// ===========================================

const fetchInstagramHype = async (restaurantName: string): Promise<{ followers: number; engagement: number } | null> => {
  const apifyClient = getApifyClient();
  if (!apifyClient) return null;
  
  try {
    // Derive likely Instagram handle from restaurant name
    const handle = restaurantName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const run = await apifyClient.actor('apify/instagram-profile-scraper').call({
      usernames: [handle],
      resultsLimit: 1
    }, { timeout: 30 }); // 30 second timeout

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (items.length > 0) {
      const profile = items[0] as any;
      return {
        followers: profile.followersCount || 0,
        engagement: profile.engagementRate || 0
      };
    }
  } catch (error: any) {
    console.log(`[Apify] Could not fetch Instagram for ${restaurantName}: ${error.message}`);
  }
  
  return null;
};

// ===========================================
// HELPER: Calculate hype score
// ===========================================

const calculateHypeScore = (followers: number, engagement: number, popularityScore: number): number => {
  // Normalize followers (0-50 points) - 100k+ followers = max
  const followerScore = Math.min(50, (followers / 100000) * 50);
  
  // Engagement rate (0-30 points) - 5%+ = max
  const engagementScore = Math.min(30, (engagement / 0.05) * 30);
  
  // Popularity from AI (0-20 points)
  const popularityPoints = (popularityScore / 100) * 20;
  
  return Math.round(followerScore + engagementScore + popularityPoints);
};

// ===========================================
// HELPER: Save to database
// ===========================================

const saveMarketData = async (data: MarketDataRow): Promise<void> => {
  if (!pool) return;

  try {
    await pool.query(`
      INSERT INTO market_data (
        restaurant_name, city, cuisine, estimated_resale_value,
        price_low, price_high, difficulty_level, popularity_score,
        trend, description, booking_window_tip, data_confidence,
        instagram_followers, instagram_engagement, hype_score,
        sources, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      ON CONFLICT (restaurant_name, city) 
      DO UPDATE SET
        estimated_resale_value = EXCLUDED.estimated_resale_value,
        price_low = EXCLUDED.price_low,
        price_high = EXCLUDED.price_high,
        difficulty_level = EXCLUDED.difficulty_level,
        popularity_score = EXCLUDED.popularity_score,
        trend = EXCLUDED.trend,
        description = EXCLUDED.description,
        instagram_followers = EXCLUDED.instagram_followers,
        instagram_engagement = EXCLUDED.instagram_engagement,
        hype_score = EXCLUDED.hype_score,
        sources = EXCLUDED.sources,
        last_updated = NOW()
    `, [
      data.restaurant_name,
      data.city,
      data.cuisine,
      data.estimated_resale_value,
      data.price_low,
      data.price_high,
      data.difficulty_level,
      data.popularity_score,
      data.trend,
      data.description,
      data.booking_window_tip,
      data.data_confidence,
      data.instagram_followers || null,
      data.instagram_engagement || null,
      data.hype_score || null,
      JSON.stringify(data.sources)
    ]);
  } catch (error: any) {
    console.error('[DB] Failed to save market data:', error.message);
  }
};

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /api/v2/market/scan
 * 
 * Scan a city for restaurant opportunities
 * Query params:
 * - city (required): City to scan
 * - limit: Number of results (default 10, max 25)
 * - refresh: Force refresh from AI (default false, uses cached if < 1hr old)
 */
router.get('/scan', async (req, res) => {
  const { city, limit = '10', refresh = 'false' } = req.query;
  
  if (!city || typeof city !== 'string') {
    return res.status(400).json({ error: 'City is required' });
  }

  const resultLimit = Math.min(25, Math.max(1, parseInt(limit as string) || 10));
  const forceRefresh = refresh === 'true';

  try {
    // Check cache first (if not forcing refresh)
    if (!forceRefresh && pool) {
      const cached = await pool.query(`
        SELECT * FROM market_data 
        WHERE city = $1 
          AND last_updated > NOW() - INTERVAL '1 hour'
        ORDER BY hype_score DESC NULLS LAST, estimated_resale_value DESC
        LIMIT $2
      `, [city, resultLimit]);

      if (cached.rows.length >= resultLimit) {
        console.log(`[MarketV2] Returning ${cached.rows.length} cached results for ${city}`);
        return res.json({
          city,
          restaurants: cached.rows,
          source: 'cache',
          count: cached.rows.length
        });
      }
    }

    console.log(`[MarketV2] Scanning ${city} for ${resultLimit} restaurants...`);

    // Get Tavily context first
    let tavilyContext = '';
    let tavilySources: any[] = [];
    const tvly = getTavilyClient();
    if (tvly) {
      try {
        const tavilyData = await tvly.search(
          `high-end restaurant reservations ${city} resale market AppointmentTrader difficult booking`,
          { max_results: 10, search_depth: 'advanced' }
        );
        if (tavilyData.results?.length > 0) {
          tavilySources = tavilyData.results.map((r: any) => ({ title: r.title, url: r.url }));
          tavilyContext = `\n\nVERIFIED MARKET DATA:\n${tavilyData.results.slice(0, 5).map((r: any) => `- ${r.title}`).join('\n')}\nSummary: ${tavilyData.answer || ''}`;
        }
        console.log(`[MarketV2] Tavily returned ${tavilyData.results?.length || 0} results`);
      } catch (e: any) {
        console.log(`[MarketV2] Tavily error: ${e.message}`);
      }
    } else {
      console.log(`[MarketV2] Tavily not configured, skipping market data lookup`);
    }

    // Fetch from Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are analyzing the restaurant reservation resale market in ${city}.
      
${tavilyContext}

Generate a JSON array of ${resultLimit} restaurants with the highest resale potential.
Include a mix of difficulty levels. Prioritize restaurants with:
1. Active resale market on AppointmentTrader or similar
2. High social media buzz
3. Long waitlists or impossible-to-get reservations

For each restaurant provide:
- name (string)
- cuisine (string)
- estimatedResaleValue (number, $50-$2000 based on difficulty)
- priceLow (number, ~70% of resale value)
- priceHigh (number, ~140% of resale value)
- difficultyLevel ("Low", "Medium", "High", "Impossible")
- popularityScore (0-100)
- trend ("UP", "DOWN", "STABLE")
- description (string, max 150 chars, describe why it's valuable)
- bookingWindowTip (string, e.g. "Resy @ 9AM EST daily")
- dataConfidence ("High", "Medium", "Low")
- instagramHandle (string, the restaurant's Instagram username if known)

Return ONLY the JSON array.`,
      config: { tools: [{ googleSearch: {} }] }
    });

    let restaurants: any[] = [];
    if (response.text) {
      restaurants = parseJsonFromText<any[]>(response.text) || [];
    }

    console.log(`[MarketV2] Gemini returned ${restaurants.length} restaurants`);

    // Enrich with Apify Instagram data and save to DB
    const enrichedRestaurants = await Promise.all(
      restaurants.map(async (r) => {
        // Fetch Instagram hype
        let hypeData = null;
        if (r.instagramHandle) {
          hypeData = await fetchInstagramHype(r.instagramHandle);
        }

        const hypeScore = hypeData 
          ? calculateHypeScore(hypeData.followers, hypeData.engagement, r.popularityScore)
          : Math.round(r.popularityScore * 0.7); // Estimate if no Instagram

        const enriched = {
          restaurant_name: r.name,
          city,
          cuisine: r.cuisine,
          estimated_resale_value: r.estimatedResaleValue || 200,
          price_low: r.priceLow || r.estimatedResaleValue * 0.7,
          price_high: r.priceHigh || r.estimatedResaleValue * 1.4,
          difficulty_level: r.difficultyLevel || 'Medium',
          popularity_score: r.popularityScore || 50,
          trend: r.trend || 'STABLE',
          description: r.description || '',
          booking_window_tip: r.bookingWindowTip || '',
          data_confidence: r.dataConfidence || 'Medium',
          instagram_followers: hypeData?.followers,
          instagram_engagement: hypeData?.engagement,
          hype_score: hypeScore,
          sources: tavilySources,
          last_updated: new Date()
        };

        // Save to database
        await saveMarketData(enriched);

        return enriched;
      })
    );

    // Sort by hype score
    enrichedRestaurants.sort((a, b) => (b.hype_score || 0) - (a.hype_score || 0));

    res.json({
      city,
      restaurants: enrichedRestaurants,
      source: 'live',
      count: enrichedRestaurants.length
    });

  } catch (error: any) {
    console.error('[MarketV2] Scan error:', error);
    res.status(500).json({ error: 'Failed to scan market', details: error.message });
  }
});

/**
 * GET /api/v2/market/list
 * 
 * List restaurants from database with filtering/sorting
 * Query params:
 * - city: Filter by city (optional, returns all cities if not specified)
 * - cities: Comma-separated list of cities
 * - sort: Sort field (hype_score, estimated_resale_value, difficulty_level, trend)
 * - order: asc or desc (default desc)
 * - difficulty: Filter by difficulty level
 * - minValue: Minimum resale value
 * - maxValue: Maximum resale value
 * - limit: Results per page (default 20)
 * - offset: Pagination offset
 */
router.get('/list', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  const {
    city,
    cities,
    sort = 'hype_score',
    order = 'desc',
    difficulty,
    minValue,
    maxValue,
    limit = '20',
    offset = '0'
  } = req.query;

  try {
    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramIndex = 1;

    // City filter
    if (city) {
      whereConditions.push(`city = $${paramIndex}`);
      params.push(city);
      paramIndex++;
    } else if (cities) {
      const cityList = (cities as string).split(',').map(c => c.trim());
      whereConditions.push(`city = ANY($${paramIndex})`);
      params.push(cityList);
      paramIndex++;
    }

    // Difficulty filter
    if (difficulty) {
      whereConditions.push(`difficulty_level = $${paramIndex}`);
      params.push(difficulty);
      paramIndex++;
    }

    // Value range filter
    if (minValue) {
      whereConditions.push(`estimated_resale_value >= $${paramIndex}`);
      params.push(parseInt(minValue as string));
      paramIndex++;
    }
    if (maxValue) {
      whereConditions.push(`estimated_resale_value <= $${paramIndex}`);
      params.push(parseInt(maxValue as string));
      paramIndex++;
    }

    // Build WHERE clause
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';

    // Validate sort field
    const validSortFields = ['hype_score', 'estimated_resale_value', 'difficulty_level', 'trend', 'popularity_score', 'last_updated'];
    const sortField = validSortFields.includes(sort as string) ? sort : 'hype_score';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    // Add pagination params
    params.push(parseInt(limit as string));
    params.push(parseInt(offset as string));

    const query = `
      SELECT * FROM market_data
      ${whereClause}
      ORDER BY ${sortField} ${sortOrder} NULLS LAST
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `SELECT COUNT(*) FROM market_data ${whereClause}`;

    const [results, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2)) // Exclude limit/offset for count
    ]);

    res.json({
      restaurants: results.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error: any) {
    console.error('[MarketV2] List error:', error);
    res.status(500).json({ error: 'Failed to list restaurants', details: error.message });
  }
});

/**
 * GET /api/v2/market/cities
 * 
 * Get list of all cities with data
 */
router.get('/cities', async (req, res) => {
  if (!pool) {
    return res.status(500).json({ error: 'Database not connected' });
  }

  try {
    const result = await pool.query(`
      SELECT city, COUNT(*) as restaurant_count, MAX(last_updated) as last_scan
      FROM market_data
      GROUP BY city
      ORDER BY restaurant_count DESC
    `);

    res.json({
      cities: result.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get cities', details: error.message });
  }
});

export default router;


