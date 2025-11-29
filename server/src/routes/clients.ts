/**
 * Client Routes
 * 
 * API endpoints for managing clients in the concierge booking model.
 * 
 * Clients are people we book reservations FOR - enabling the concierge
 * business model where our name never appears on the reservation.
 */

import express from 'express';
import clientManager from '../services/clientManager';

const router = express.Router();

// =====================================================
// CLIENT CRUD
// =====================================================

/**
 * GET /api/clients
 * Get all clients
 */
router.get('/', async (req, res) => {
  try {
    const clients = await clientManager.getAllClients();
    res.json(clients);
  } catch (error: any) {
    console.error('[Clients API] Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/stats
 * Get client statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await clientManager.getStats();
    res.json(stats);
  } catch (error: any) {
    console.error('[Clients API] Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/search
 * Search clients by name, email, or company
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    const clients = await clientManager.searchClients(q);
    res.json(clients);
  } catch (error: any) {
    console.error('[Clients API] Error searching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/priority
 * Get VIP and Platinum clients (priority for sniping)
 */
router.get('/priority', async (req, res) => {
  try {
    const clients = await clientManager.getPriorityClients();
    res.json(clients);
  } catch (error: any) {
    console.error('[Clients API] Error fetching priority clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/unsynced/opentable
 * Get clients not yet synced to OpenTable's diner list
 */
router.get('/unsynced/opentable', async (req, res) => {
  try {
    const clients = await clientManager.getUnsyncedOpenTableClients();
    res.json(clients);
  } catch (error: any) {
    console.error('[Clients API] Error fetching unsynced clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/:id
 * Get a specific client
 */
router.get('/:id', async (req, res) => {
  try {
    const client = await clientManager.getClientById(parseInt(req.params.id));
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error: any) {
    console.error('[Clients API] Error fetching client:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/clients
 * Create a new client
 */
router.post('/', async (req, res) => {
  try {
    const { first_name, last_name, email, phone } = req.body;
    
    // Validate required fields
    if (!first_name || !last_name || !email || !phone) {
      return res.status(400).json({ 
        error: 'Missing required fields: first_name, last_name, email, phone' 
      });
    }

    // Check if client with email already exists
    const existing = await clientManager.getClientByEmail(email);
    if (existing) {
      return res.status(409).json({ 
        error: 'A client with this email already exists',
        existingClient: existing
      });
    }

    const client = await clientManager.createClient(req.body);
    res.status(201).json(client);
  } catch (error: any) {
    console.error('[Clients API] Error creating client:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/clients/:id
 * Update a client
 */
router.put('/:id', async (req, res) => {
  try {
    const client = await clientManager.updateClient(parseInt(req.params.id), req.body);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(client);
  } catch (error: any) {
    console.error('[Clients API] Error updating client:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await clientManager.deleteClient(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ success: true, message: 'Client deleted' });
  } catch (error: any) {
    console.error('[Clients API] Error deleting client:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// PLATFORM SYNC
// =====================================================

/**
 * POST /api/clients/:id/sync/opentable
 * Mark client as synced to OpenTable (after adding to diner list)
 */
router.post('/:id/sync/opentable', async (req, res) => {
  try {
    const { diner_id } = req.body;
    await clientManager.markSyncedToOpenTable(parseInt(req.params.id), diner_id);
    res.json({ 
      success: true, 
      message: 'Client synced to OpenTable',
      note: 'Make sure to add this client to your OpenTable Professional Profile diner list'
    });
  } catch (error: any) {
    console.error('[Clients API] Error syncing to OpenTable:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/clients/:id/sync/resy
 * Mark client as synced to Resy
 */
router.post('/:id/sync/resy', async (req, res) => {
  try {
    await clientManager.markSyncedToResy(parseInt(req.params.id));
    res.json({ 
      success: true, 
      message: 'Client marked as Resy-ready',
      note: 'Resy Concierge accounts can book for any guest - no pre-sync required'
    });
  } catch (error: any) {
    console.error('[Clients API] Error syncing to Resy:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// BOOKING REQUESTS
// =====================================================

/**
 * GET /api/clients/:id/requests
 * Get booking requests for a specific client
 */
router.get('/:id/requests', async (req, res) => {
  try {
    const requests = await clientManager.getClientBookingRequests(parseInt(req.params.id));
    res.json(requests);
  } catch (error: any) {
    console.error('[Clients API] Error fetching booking requests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/clients/:id/requests
 * Create a booking request for a client
 */
router.post('/:id/requests', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    
    // Verify client exists
    const client = await clientManager.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const { restaurant_name, desired_date, party_size } = req.body;
    
    if (!restaurant_name || !desired_date || !party_size) {
      return res.status(400).json({ 
        error: 'Missing required fields: restaurant_name, desired_date, party_size' 
      });
    }

    const request = await clientManager.createBookingRequest({
      client_id: clientId,
      ...req.body
    });
    
    res.status(201).json(request);
  } catch (error: any) {
    console.error('[Clients API] Error creating booking request:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/clients/requests/pending
 * Get all pending booking requests across all clients
 */
router.get('/requests/pending', async (req, res) => {
  try {
    const requests = await clientManager.getPendingBookingRequests();
    res.json(requests);
  } catch (error: any) {
    console.error('[Clients API] Error fetching pending requests:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/clients/requests/:requestId/status
 * Update booking request status
 */
router.put('/requests/:requestId/status', async (req, res) => {
  try {
    const { status, transfer_id, failure_reason } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    await clientManager.updateBookingRequestStatus(
      parseInt(req.params.requestId),
      status,
      transfer_id,
      failure_reason
    );
    
    res.json({ success: true, message: 'Booking request updated' });
  } catch (error: any) {
    console.error('[Clients API] Error updating booking request:', error);
    res.status(500).json({ error: error.message });
  }
});

// =====================================================
// BOOKING TRACKING
// =====================================================

/**
 * POST /api/clients/:id/record-booking
 * Record a successful booking for a client
 */
router.post('/:id/record-booking', async (req, res) => {
  try {
    const { service_fee } = req.body;
    await clientManager.recordBooking(parseInt(req.params.id), service_fee);
    res.json({ success: true, message: 'Booking recorded' });
  } catch (error: any) {
    console.error('[Clients API] Error recording booking:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

