/**
 * Restaurant API Routes
 * 
 * These endpoints serve data FROM THE DATABASE (source of truth)
 * NOT from LLM responses.
 */

import { Router } from 'express';
import { getRestaurantsByCity, getPriceHistory, runPriceUpdate, seedRestaurants, upsertRestaurant } from '../services/priceScraper';
import { fetchMarketInsight } from '../services/geminiService';

const router = Router();

/**
 * GET /api/restaurants?city=New York City
 * 
 * Returns restaurants from the DATABASE with consistent pricing
 */
router.get('/', async (req, res) => {
  try {
    const city = req.query.city as string;
    
    if (!city) {
      return res.status(400).json({ error: 'City parameter required' });
    }

    const restaurants = await getRestaurantsByCity(city);
    
    // If no restaurants found, return empty array (frontend can handle gracefully)
    if (restaurants.length === 0) {
      console.log(`[API] No restaurants found for ${city} - consider running seed or scraper`);
    }

    // Format for frontend compatibility
    const formatted = restaurants.map(r => ({
      id: r.id,
      name: r.name,
      cuisine: r.cuisine || 'Fine Dining',
      estimatedResaleValue: Number(r.estimatedResaleValue) || 0,
      priceLow: Number(r.priceLow) || 0,
      priceHigh: Number(r.priceHigh) || 0,
      difficultyLevel: r.difficultyLevel || 'Medium',
      popularityScore: r.popularityScore || 50,
      trend: r.trend || 'STABLE',
      dataConfidence: r.dataConfidence || 'Medium',
      description: r.description || '',
      bookingWindowTip: r.bookingWindowTip || '',
      platform: r.platform || 'Resy',
      bookingUrl: r.bookingUrl || '',
      nextDropDate: r.nextDropDate,
      nextDropTime: r.nextDropTime,
      dropTimezone: r.dropTimezone,
      dropPattern: r.dropPattern,
      lastPriceUpdate: r.lastPriceUpdate,
      // Add sources array for UI compatibility
      sources: r.lastPriceUpdate ? [{ title: 'Database', uri: '' }] : []
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[API] Error fetching restaurants:', error);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

/**
 * GET /api/restaurants/:id/history
 * 
 * Returns price history for trend charts (last 7 days)
 */
router.get('/:id/history', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const days = parseInt(req.query.days as string) || 7;

    const history = await getPriceHistory(restaurantId, days);
    
    // Format for Recharts
    const formatted = history.map(h => ({
      day: new Date(h.day).toLocaleDateString('en-US', { weekday: 'short' }),
      value: Number(h.value),
      volume: Number(h.volume)
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[API] Error fetching price history:', error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

/**
 * GET /api/restaurants/:id/insight
 * 
 * Returns detailed strategy from Gemini (this still uses AI for strategy text)
 * But pricing data comes from the database
 */
router.get('/:id/insight', async (req, res) => {
  try {
    const restaurantId = parseInt(req.params.id);
    const city = req.query.city as string || 'New York City';
    
    // Get restaurant from DB first
    const restaurants = await getRestaurantsByCity(city);
    const restaurant = restaurants.find(r => r.id === restaurantId);
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    // Get strategy from Gemini (for tactical advice)
    const insight = await fetchMarketInsight(restaurant.name, city);

    // Merge DB data (source of truth) with AI insight
    res.json({
      ...insight,
      // Override with DB values for consistency
      nextDropDate: restaurant.nextDropDate || insight?.nextDropDate,
      nextDropTime: restaurant.nextDropTime || insight?.nextDropTime,
      dropTimezone: restaurant.dropTimezone || insight?.dropTimezone,
      dropPattern: restaurant.dropPattern || insight?.dropPattern,
      platform: restaurant.platform || insight?.platform,
      bookingUrl: restaurant.bookingUrl || insight?.bookingUrl
    });
  } catch (error) {
    console.error('[API] Error fetching insight:', error);
    res.status(500).json({ error: 'Failed to fetch insight' });
  }
});

/**
 * POST /api/restaurants/seed
 * 
 * Seeds the database with initial restaurant data
 * Run this once to populate the DB
 */
router.post('/seed', async (req, res) => {
  try {
    await seedRestaurants();
    res.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('[API] Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

/**
 * POST /api/restaurants/scrape
 * 
 * Triggers a price scrape for a city
 * This would be called by a cron job daily
 */
router.post('/scrape', async (req, res) => {
  try {
    const { city } = req.body;
    
    if (!city) {
      return res.status(400).json({ error: 'City required' });
    }

    const result = await runPriceUpdate(city);
    res.json(result);
  } catch (error) {
    console.error('[API] Scrape error:', error);
    res.status(500).json({ error: 'Failed to run price scrape' });
  }
});

/**
 * PUT /api/restaurants/:id
 * 
 * Manually update a restaurant's data (admin function)
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, city, ...data } = req.body;
    
    if (!name || !city) {
      return res.status(400).json({ error: 'Name and city required' });
    }

    const restaurant = await upsertRestaurant(name, city, data);
    res.json(restaurant);
  } catch (error) {
    console.error('[API] Update error:', error);
    res.status(500).json({ error: 'Failed to update restaurant' });
  }
});

export default router;










