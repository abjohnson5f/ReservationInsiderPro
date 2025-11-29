/**
 * Analytics API Routes
 * 
 * Endpoints for:
 * - Dynamic Pricing Engine
 * - Drop Pattern Learning
 * - Acquisition History
 * - Competition Monitor
 * - Communication Templates
 * - Credential Validation
 */

import { Router } from 'express';
import pricingEngine from '../services/pricingEngine';
import dropPatternLearning from '../services/dropPatternLearning';
import competitionMonitor from '../services/competitionMonitor';
import communicationTemplates from '../services/communicationTemplates';
import credentialValidator from '../services/credentialValidator';

const router = Router();

// ============================================
// DYNAMIC PRICING ENGINE
// ============================================

/**
 * POST /api/analytics/pricing/suggest
 * Get suggested price for a reservation
 */
router.post('/pricing/suggest', async (req, res) => {
  try {
    const { restaurantName, platform, reservationDate, reservationTime, partySize, city } = req.body;
    
    if (!restaurantName || !reservationDate || !reservationTime || !partySize) {
      return res.status(400).json({
        success: false,
        error: 'restaurantName, reservationDate, reservationTime, and partySize are required',
      });
    }
    
    const suggestion = await pricingEngine.getSuggestedPrice({
      restaurantName,
      platform: platform || 'resy',
      reservationDate,
      reservationTime,
      partySize,
      city,
    });
    
    res.json({
      success: true,
      ...suggestion,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/pricing/stats
 * Get pricing analytics
 */
router.get('/pricing/stats', async (req, res) => {
  try {
    const analytics = await pricingEngine.getPricingAnalytics();
    res.json({ success: true, ...analytics });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/pricing/tiers
 * Get all restaurant tiers
 */
router.get('/pricing/tiers', (req, res) => {
  const tiers = pricingEngine.getRestaurantTiers();
  res.json({ success: true, tiers });
});

/**
 * POST /api/analytics/pricing/tiers
 * Add/update a restaurant tier
 */
router.post('/pricing/tiers', (req, res) => {
  const { name, tier, basePrice } = req.body;
  
  if (!name || !tier || !basePrice) {
    return res.status(400).json({
      success: false,
      error: 'name, tier, and basePrice are required',
    });
  }
  
  pricingEngine.addRestaurantTier(name, tier, basePrice);
  res.json({ success: true, message: `Tier added for ${name}` });
});

// ============================================
// DROP PATTERN LEARNING
// ============================================

/**
 * POST /api/analytics/patterns/init
 * Initialize pattern tables
 */
router.post('/patterns/init', async (req, res) => {
  try {
    await dropPatternLearning.initTable();
    res.json({ success: true, message: 'Pattern tables initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/patterns
 * Get all known drop patterns
 */
router.get('/patterns', async (req, res) => {
  try {
    const patterns = await dropPatternLearning.getAllPatterns();
    res.json({ success: true, count: patterns.length, patterns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/patterns/:restaurantName
 * Get drop pattern for a specific restaurant
 */
router.get('/patterns/:restaurantName', async (req, res) => {
  try {
    const { restaurantName } = req.params;
    const { platform } = req.query;
    
    const pattern = await dropPatternLearning.getPattern(
      restaurantName,
      platform as string | undefined
    );
    
    if (pattern) {
      res.json({ success: true, pattern });
    } else {
      res.json({ success: false, message: 'No pattern found for this restaurant' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/patterns
 * Add a known drop pattern manually
 */
router.post('/patterns', async (req, res) => {
  try {
    const { restaurant_name, platform, days_in_advance, drop_time, drop_timezone, drop_day_of_week, confidence, notes } = req.body;
    
    if (!restaurant_name || !platform || days_in_advance === undefined || !drop_time) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_name, platform, days_in_advance, and drop_time are required',
      });
    }
    
    await dropPatternLearning.addPattern({
      restaurant_name,
      platform,
      days_in_advance,
      drop_time,
      drop_timezone: drop_timezone || 'America/New_York',
      drop_day_of_week,
      confidence: confidence || 50,
      successful_acquisitions: 0,
      total_attempts: 0,
      last_confirmed: new Date(),
      notes,
    });
    
    res.json({ success: true, message: 'Pattern added' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/attempts
 * Record an acquisition attempt
 */
router.post('/attempts', async (req, res) => {
  try {
    const { restaurantName, platform, targetDate, attemptTime, success, confirmationCode, error, identityId } = req.body;
    
    if (!restaurantName || !platform || !targetDate || success === undefined) {
      return res.status(400).json({
        success: false,
        error: 'restaurantName, platform, targetDate, and success are required',
      });
    }
    
    await dropPatternLearning.recordAttempt({
      restaurantName,
      platform,
      targetDate,
      attemptTime: attemptTime ? new Date(attemptTime) : new Date(),
      success,
      confirmationCode,
      error,
    }, identityId);
    
    res.json({ success: true, message: 'Attempt recorded' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/attempts
 * Get acquisition history
 */
router.get('/attempts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await dropPatternLearning.getAcquisitionHistory(limit);
    res.json({ success: true, count: history.length, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/success-stats
 * Get success rate statistics
 */
router.get('/success-stats', async (req, res) => {
  try {
    const stats = await dropPatternLearning.getSuccessStats();
    res.json({ success: true, ...stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COMPETITION MONITOR
// ============================================

/**
 * POST /api/analytics/competition/init
 * Initialize competition tables
 */
router.post('/competition/init', async (req, res) => {
  try {
    await competitionMonitor.initTable();
    res.json({ success: true, message: 'Competition tables initialized' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/competition/listings
 * Get all active competitor listings
 */
router.get('/competition/listings', async (req, res) => {
  try {
    const listings = await competitionMonitor.getAllActiveListings();
    res.json({ success: true, count: listings.length, listings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/competition/listings/:restaurantName
 * Get competitor listings for a restaurant
 */
router.get('/competition/listings/:restaurantName', async (req, res) => {
  try {
    const listings = await competitionMonitor.getListingsForRestaurant(req.params.restaurantName);
    res.json({ success: true, count: listings.length, listings });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/competition/listings
 * Track a competitor listing
 */
router.post('/competition/listings', async (req, res) => {
  try {
    const listing = req.body;
    
    if (!listing.seller_name || !listing.restaurant_name) {
      return res.status(400).json({
        success: false,
        error: 'seller_name and restaurant_name are required',
      });
    }
    
    await competitionMonitor.trackListing(listing);
    res.json({ success: true, message: 'Listing tracked' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/competition/stats
 * Get competitor statistics
 */
router.get('/competition/stats', async (req, res) => {
  try {
    const stats = await competitionMonitor.getCompetitorStats();
    res.json({ success: true, count: stats.length, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/competition/market/:restaurantName
 * Get market pricing for a restaurant
 */
router.get('/competition/market/:restaurantName', async (req, res) => {
  try {
    const pricing = await competitionMonitor.getMarketPricing(req.params.restaurantName);
    res.json({ success: true, ...pricing });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COMMUNICATION TEMPLATES
// ============================================

/**
 * POST /api/analytics/templates/transfer
 * Generate transfer instructions
 */
router.post('/templates/transfer', (req, res) => {
  try {
    const details = req.body;
    
    if (!details.restaurantName || !details.buyerName || !details.transferMethod) {
      return res.status(400).json({
        success: false,
        error: 'restaurantName, buyerName, and transferMethod are required',
      });
    }
    
    const instructions = communicationTemplates.getTransferInstructions(details);
    res.json({ success: true, instructions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/templates/listing
 * Generate AT listing description
 */
router.post('/templates/listing', (req, res) => {
  try {
    const details = req.body;
    
    if (!details.restaurantName || !details.price) {
      return res.status(400).json({
        success: false,
        error: 'restaurantName and price are required',
      });
    }
    
    const description = communicationTemplates.getATListingDescription(details);
    res.json({ success: true, description });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/templates/confirmation
 * Generate sale confirmation message
 */
router.post('/templates/confirmation', (req, res) => {
  try {
    const details = req.body;
    
    if (!details.buyerName || !details.restaurantName || !details.price) {
      return res.status(400).json({
        success: false,
        error: 'buyerName, restaurantName, and price are required',
      });
    }
    
    const message = communicationTemplates.getSaleConfirmationMessage(details);
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/analytics/templates/acquisition-success
 * Generate acquisition success notification
 */
router.post('/templates/acquisition-success', (req, res) => {
  try {
    const details = req.body;
    
    if (!details.restaurantName) {
      return res.status(400).json({
        success: false,
        error: 'restaurantName is required',
      });
    }
    
    const message = communicationTemplates.getAcquisitionSuccessMessage(details);
    res.json({ success: true, message });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/templates/types
 * Get all template types
 */
router.get('/templates/types', (req, res) => {
  const types = communicationTemplates.getTemplateTypes();
  res.json({ success: true, types });
});

// ============================================
// CREDENTIAL VALIDATION
// ============================================

/**
 * POST /api/analytics/validate/:identityId
 * Validate all credentials for an identity
 */
router.post('/validate/:identityId', async (req, res) => {
  try {
    const identityId = parseInt(req.params.identityId);
    const result = await credentialValidator.validateIdentity(identityId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/validate
 * Validate all identities
 */
router.get('/validate', async (req, res) => {
  try {
    const results = await credentialValidator.validateAllIdentities();
    res.json({ success: true, count: results.length, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/validate/:identityId/:platform
 * Check if a specific platform is ready for an identity
 */
router.get('/validate/:identityId/:platform', async (req, res) => {
  try {
    const identityId = parseInt(req.params.identityId);
    const { platform } = req.params;
    const ready = await credentialValidator.isPlatformReady(identityId, platform);
    res.json({ success: true, platform, ready });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

