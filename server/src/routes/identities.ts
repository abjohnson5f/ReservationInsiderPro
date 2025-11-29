/**
 * Identity Management API Routes
 * 
 * Handles CRUD operations for booking identities and usage tracking.
 */

import { Router } from 'express';
import identityManager from '../services/identityManager';

const router = Router();

/**
 * GET /api/identities
 * Get all active identities
 */
router.get('/', async (req, res) => {
  try {
    const identities = await identityManager.getAllIdentities();
    
    // Mask sensitive credentials in response
    const safeIdentities = identities.map(identity => ({
      ...identity,
      resy_auth_token: identity.resy_auth_token ? '***configured***' : null,
      resy_payment_id: identity.resy_payment_id ? '***configured***' : null,
      opentable_csrf_token: identity.opentable_csrf_token ? '***configured***' : null,
      opentable_session_cookie: identity.opentable_session_cookie ? '***configured***' : null,
      tock_auth_token: identity.tock_auth_token ? '***configured***' : null,
    }));
    
    res.json({ success: true, identities: safeIdentities });
  } catch (error: any) {
    console.error('[API] Error fetching identities:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/identities/stats
 * Get usage statistics for all identities
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await identityManager.getUsageStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[API] Error fetching identity stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/identities/:id
 * Get a specific identity by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const identity = await identityManager.getIdentity(parseInt(req.params.id));
    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }
    
    // Mask sensitive credentials
    const safeIdentity = {
      ...identity,
      resy_auth_token: identity.resy_auth_token ? '***configured***' : null,
      resy_payment_id: identity.resy_payment_id ? '***configured***' : null,
      opentable_csrf_token: identity.opentable_csrf_token ? '***configured***' : null,
      opentable_session_cookie: identity.opentable_session_cookie ? '***configured***' : null,
      tock_auth_token: identity.tock_auth_token ? '***configured***' : null,
    };
    
    res.json({ success: true, identity: safeIdentity });
  } catch (error: any) {
    console.error('[API] Error fetching identity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/identities
 * Create a new identity
 */
router.post('/', async (req, res) => {
  try {
    const {
      name, email, phone,
      resy_auth_token, resy_payment_id, resy_api_key,
      opentable_csrf_token, opentable_session_cookie, opentable_gpid,
      sevenrooms_first_name, sevenrooms_last_name, sevenrooms_email, sevenrooms_phone,
      tock_auth_token, tock_email, tock_phone,
      monthly_limit
    } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'name and email are required' });
    }
    
    const identity = await identityManager.createIdentity({
      name, email, phone,
      resy_auth_token, resy_payment_id, resy_api_key,
      opentable_csrf_token, opentable_session_cookie, opentable_gpid,
      sevenrooms_first_name, sevenrooms_last_name, sevenrooms_email, sevenrooms_phone,
      tock_auth_token, tock_email, tock_phone,
      monthly_limit
    });
    
    res.json({ success: true, identity: { id: identity.id, name: identity.name } });
  } catch (error: any) {
    console.error('[API] Error creating identity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/identities/:id
 * Update an existing identity
 */
router.put('/:id', async (req, res) => {
  try {
    const identity = await identityManager.updateIdentity(parseInt(req.params.id), req.body);
    if (!identity) {
      return res.status(404).json({ success: false, error: 'Identity not found or no valid fields to update' });
    }
    res.json({ success: true, identity: { id: identity.id, name: identity.name } });
  } catch (error: any) {
    console.error('[API] Error updating identity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/identities/:id
 * Soft delete an identity
 */
router.delete('/:id', async (req, res) => {
  try {
    const success = await identityManager.deleteIdentity(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ success: false, error: 'Identity not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting identity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/identities/reset-monthly
 * Reset monthly booking counts (admin endpoint)
 */
router.post('/reset-monthly', async (req, res) => {
  try {
    await identityManager.resetMonthlyCounts();
    res.json({ success: true, message: 'Monthly counts reset' });
  } catch (error: any) {
    console.error('[API] Error resetting monthly counts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/identities/best/:platform
 * Get the best available identity for a platform
 */
router.get('/best/:platform', async (req, res) => {
  try {
    const platform = req.params.platform as 'resy' | 'opentable' | 'sevenrooms' | 'tock';
    const identity = await identityManager.getBestIdentityForPlatform(platform);
    
    if (!identity) {
      return res.json({ 
        success: true, 
        identity: null, 
        message: `No identity with ${platform} capacity available` 
      });
    }
    
    res.json({ 
      success: true, 
      identity: {
        id: identity.id,
        name: identity.name,
        configured: identityManager.getConfiguredPlatforms(identity)
      }
    });
  } catch (error: any) {
    console.error('[API] Error finding best identity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

