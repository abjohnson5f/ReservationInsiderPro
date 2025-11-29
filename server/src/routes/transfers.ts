/**
 * Transfer & AT Listing API Routes
 * 
 * Handles the complete transfer workflow:
 * ACQUIRED -> LISTED -> SOLD -> TRANSFER_PENDING -> TRANSFERRED -> COMPLETED
 */

import { Router } from 'express';
import transferTracker, { TransferMethod, TransferStatus } from '../services/transferTracker';

const router = Router();

/**
 * GET /api/transfers
 * Get all transfers with optional filtering
 */
router.get('/', async (req, res) => {
  try {
    const { status, platform, upcoming } = req.query;
    
    const transfers = await transferTracker.getTransfers({
      status: status as TransferStatus,
      platform: platform as string,
      upcoming_only: upcoming === 'true',
    });
    
    res.json({ success: true, transfers });
  } catch (error: any) {
    console.error('[API] Error fetching transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transfers/stats
 * Get revenue and transfer statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const stats = await transferTracker.getRevenueStats({
      start_date: start_date as string,
      end_date: end_date as string,
    });
    
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('[API] Error fetching transfer stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transfers/action-needed
 * Get transfers that need action (upcoming deadlines)
 */
router.get('/action-needed', async (req, res) => {
  try {
    const transfers = await transferTracker.getTransfersNeedingAction();
    res.json({ success: true, transfers });
  } catch (error: any) {
    console.error('[API] Error fetching action-needed transfers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transfers/:id
 * Get a specific transfer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const transfer = await transferTracker.getTransfer(parseInt(req.params.id));
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error fetching transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/transfers
 * Create a new transfer (typically called by acquisition engine)
 */
router.post('/', async (req, res) => {
  try {
    const {
      portfolio_item_id,
      restaurant_name,
      platform,
      reservation_date,
      reservation_time,
      party_size,
      confirmation_number,
      booking_identity_id
    } = req.body;
    
    if (!restaurant_name || !platform || !reservation_date || !reservation_time || !party_size) {
      return res.status(400).json({
        success: false,
        error: 'restaurant_name, platform, reservation_date, reservation_time, and party_size are required'
      });
    }
    
    const transfer = await transferTracker.createTransfer({
      portfolio_item_id,
      restaurant_name,
      platform,
      reservation_date,
      reservation_time,
      party_size,
      confirmation_number,
      booking_identity_id
    });
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error creating transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/transfers/:id/listed
 * Mark a transfer as listed on AT
 */
router.put('/:id/listed', async (req, res) => {
  try {
    const { at_listing_id, at_listing_url, listing_price } = req.body;
    
    if (!listing_price) {
      return res.status(400).json({ success: false, error: 'listing_price is required' });
    }
    
    const transfer = await transferTracker.markAsListed(parseInt(req.params.id), {
      at_listing_id,
      at_listing_url,
      listing_price
    });
    
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error marking transfer as listed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/transfers/:id/sold
 * Mark a transfer as sold
 */
router.put('/:id/sold', async (req, res) => {
  try {
    const { buyer_name, buyer_email, buyer_phone, sale_price, transfer_method } = req.body;
    
    if (!buyer_name || !sale_price || !transfer_method) {
      return res.status(400).json({
        success: false,
        error: 'buyer_name, sale_price, and transfer_method are required'
      });
    }
    
    const transfer = await transferTracker.markAsSold(parseInt(req.params.id), {
      buyer_name,
      buyer_email,
      buyer_phone,
      sale_price,
      transfer_method: transfer_method as TransferMethod
    });
    
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error marking transfer as sold:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/transfers/:id/transfer-pending
 * Mark transfer as pending (buyer notified)
 */
router.put('/:id/transfer-pending', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const transfer = await transferTracker.markAsTransferPending(parseInt(req.params.id), notes);
    
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error marking transfer as pending:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/transfers/:id/transferred
 * Mark transfer as transferred
 */
router.put('/:id/transferred', async (req, res) => {
  try {
    const { notes } = req.body;
    
    const transfer = await transferTracker.markAsTransferred(parseInt(req.params.id), notes);
    
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error marking transfer as transferred:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/transfers/:id/completed
 * Mark transfer as completed
 */
router.put('/:id/completed', async (req, res) => {
  try {
    const transfer = await transferTracker.markAsCompleted(parseInt(req.params.id));
    
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    res.json({ success: true, transfer });
  } catch (error: any) {
    console.error('[API] Error marking transfer as completed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/transfers/:id
 * Delete a transfer
 */
router.delete('/:id', async (req, res) => {
  try {
    const success = await transferTracker.deleteTransfer(parseInt(req.params.id));
    if (!success) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/transfers/:id/at-listing
 * Generate AT-ready listing text
 */
router.get('/:id/at-listing', async (req, res) => {
  try {
    const transfer = await transferTracker.getTransfer(parseInt(req.params.id));
    if (!transfer) {
      return res.status(404).json({ success: false, error: 'Transfer not found' });
    }
    
    const listing = transferTracker.generateATListing(transfer);
    res.json({ success: true, listing });
  } catch (error: any) {
    console.error('[API] Error generating AT listing:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

