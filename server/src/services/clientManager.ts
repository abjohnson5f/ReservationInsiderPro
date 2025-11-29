/**
 * Client Manager Service
 * 
 * Manages clients for the concierge booking model.
 * Clients are people we book reservations FOR - the reservation
 * appears under THEIR name, not ours.
 * 
 * Key Benefits:
 * - No flagging risk (our name never appears on reservations)
 * - No transfer needed (already in client's name)
 * - Legitimate business model (executive assistant/concierge service)
 * - Build recurring revenue from repeat clients
 */

import pool from '../db';

// Helper to ensure pool is initialized
const getPool = () => {
  if (!pool) {
    throw new Error('Database pool is not initialized');
  }
  return pool;
};

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
  vip_level: 'standard' | 'vip' | 'platinum';
  synced_to_opentable: boolean;
  synced_to_resy: boolean;
  opentable_diner_id?: string;
  total_bookings: number;
  successful_bookings: number;
  total_revenue: number;
  last_booking_date?: string;
  preferred_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size: number;
  preferred_time_slot?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company?: string;
  notes?: string;
  vip_level?: 'standard' | 'vip' | 'platinum';
  preferred_cuisines?: string[];
  dietary_restrictions?: string[];
  preferred_party_size?: number;
  preferred_time_slot?: string;
}

export interface ClientBookingRequest {
  id: number;
  client_id: number;
  restaurant_name: string;
  platform?: string;
  venue_id?: string;
  desired_date: string;
  desired_time?: string;
  time_flexibility: number;
  party_size: number;
  special_requests?: string;
  occasion?: string;
  max_service_fee?: number;
  status: 'pending' | 'searching' | 'acquired' | 'failed' | 'cancelled';
  attempts: number;
  last_attempt_at?: string;
  acquired_at?: string;
  transfer_id?: number;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

export interface ClientStats {
  totalClients: number;
  vipClients: number;
  platinumClients: number;
  totalBookings: number;
  totalRevenue: number;
  avgBookingsPerClient: number;
  clientsByVipLevel: { level: string; count: number }[];
  topClients: Client[];
  recentClients: Client[];
}

class ClientManager {
  // =====================================================
  // CRUD OPERATIONS
  // =====================================================

  /**
   * Get all clients
   */
  async getAllClients(): Promise<Client[]> {
    const client = await getPool().connect();
    try {
      const result = await client.query<Client>(
        `SELECT * FROM clients ORDER BY last_name, first_name`
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get client by ID
   */
  async getClientById(id: number): Promise<Client | null> {
    const client = await getPool().connect();
    try {
      const result = await client.query<Client>(
        `SELECT * FROM clients WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get client by email
   */
  async getClientByEmail(email: string): Promise<Client | null> {
    const client = await getPool().connect();
    try {
      const result = await client.query<Client>(
        `SELECT * FROM clients WHERE email = $1`,
        [email]
      );
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new client
   */
  async createClient(input: CreateClientInput): Promise<Client> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<Client>(
        `INSERT INTO clients (
          first_name, last_name, email, phone, company, notes, 
          vip_level, preferred_cuisines, dietary_restrictions,
          preferred_party_size, preferred_time_slot
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          input.first_name,
          input.last_name,
          input.email,
          input.phone,
          input.company || null,
          input.notes || null,
          input.vip_level || 'standard',
          input.preferred_cuisines || null,
          input.dietary_restrictions || null,
          input.preferred_party_size || 2,
          input.preferred_time_slot || null,
        ]
      );
      
      console.log(`[ClientManager] Created client: ${input.first_name} ${input.last_name}`);
      return result.rows[0];
    } finally {
      dbClient.release();
    }
  }

  /**
   * Update a client
   */
  async updateClient(id: number, updates: Partial<CreateClientInput>): Promise<Client | null> {
    const dbClient = await getPool().connect();
    try {
      // Build dynamic update query
      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const updateableFields = [
        'first_name', 'last_name', 'email', 'phone', 'company', 'notes',
        'vip_level', 'preferred_cuisines', 'dietary_restrictions',
        'preferred_party_size', 'preferred_time_slot'
      ];

      for (const field of updateableFields) {
        if (updates[field as keyof CreateClientInput] !== undefined) {
          fields.push(`${field} = $${paramIndex}`);
          values.push(updates[field as keyof CreateClientInput]);
          paramIndex++;
        }
      }

      if (fields.length === 0) {
        return this.getClientById(id);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id);

      const result = await dbClient.query<Client>(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      return result.rows[0] || null;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Delete a client
   */
  async deleteClient(id: number): Promise<boolean> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query(
        `DELETE FROM clients WHERE id = $1`,
        [id]
      );
      return (result.rowCount ?? 0) > 0;
    } finally {
      dbClient.release();
    }
  }

  // =====================================================
  // PLATFORM SYNC OPERATIONS
  // =====================================================

  /**
   * Mark client as synced to OpenTable's diner list
   * (For Professional Profile accounts)
   */
  async markSyncedToOpenTable(clientId: number, dinerId?: string): Promise<void> {
    const dbClient = await getPool().connect();
    try {
      await dbClient.query(
        `UPDATE clients 
         SET synced_to_opentable = TRUE, 
             opentable_diner_id = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [clientId, dinerId || null]
      );
      console.log(`[ClientManager] Client ${clientId} synced to OpenTable`);
    } finally {
      dbClient.release();
    }
  }

  /**
   * Mark client as synced to Resy
   * (Resy concierge accounts can book for anyone, so this is informational)
   */
  async markSyncedToResy(clientId: number): Promise<void> {
    const dbClient = await getPool().connect();
    try {
      await dbClient.query(
        `UPDATE clients 
         SET synced_to_resy = TRUE, updated_at = NOW()
         WHERE id = $1`,
        [clientId]
      );
      console.log(`[ClientManager] Client ${clientId} synced to Resy`);
    } finally {
      dbClient.release();
    }
  }

  /**
   * Get clients not yet synced to OpenTable
   */
  async getUnsyncedOpenTableClients(): Promise<Client[]> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<Client>(
        `SELECT * FROM clients WHERE synced_to_opentable = FALSE ORDER BY created_at`
      );
      return result.rows;
    } finally {
      dbClient.release();
    }
  }

  // =====================================================
  // BOOKING TRACKING
  // =====================================================

  /**
   * Record a successful booking for a client
   */
  async recordBooking(clientId: number, serviceFee?: number): Promise<void> {
    const dbClient = await getPool().connect();
    try {
      await dbClient.query(
        `UPDATE clients 
         SET 
           total_bookings = total_bookings + 1,
           successful_bookings = successful_bookings + 1,
           total_revenue = total_revenue + COALESCE($2, 0),
           last_booking_date = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [clientId, serviceFee || 0]
      );
      console.log(`[ClientManager] Recorded booking for client ${clientId}, fee: $${serviceFee || 0}`);
    } finally {
      dbClient.release();
    }
  }

  /**
   * Record a failed booking attempt
   */
  async recordFailedAttempt(clientId: number): Promise<void> {
    const dbClient = await getPool().connect();
    try {
      await dbClient.query(
        `UPDATE clients 
         SET total_bookings = total_bookings + 1, updated_at = NOW()
         WHERE id = $1`,
        [clientId]
      );
    } finally {
      dbClient.release();
    }
  }

  // =====================================================
  // BOOKING REQUESTS
  // =====================================================

  /**
   * Create a booking request from a client
   */
  async createBookingRequest(request: {
    client_id: number;
    restaurant_name: string;
    platform?: string;
    venue_id?: string;
    desired_date: string;
    desired_time?: string;
    time_flexibility?: number;
    party_size: number;
    special_requests?: string;
    occasion?: string;
    max_service_fee?: number;
    expires_at?: string;
  }): Promise<ClientBookingRequest> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<ClientBookingRequest>(
        `INSERT INTO client_booking_requests (
          client_id, restaurant_name, platform, venue_id,
          desired_date, desired_time, time_flexibility, party_size,
          special_requests, occasion, max_service_fee, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          request.client_id,
          request.restaurant_name,
          request.platform || null,
          request.venue_id || null,
          request.desired_date,
          request.desired_time || null,
          request.time_flexibility || 60,
          request.party_size,
          request.special_requests || null,
          request.occasion || null,
          request.max_service_fee || null,
          request.expires_at || null,
        ]
      );
      
      console.log(`[ClientManager] Created booking request for client ${request.client_id}: ${request.restaurant_name}`);
      return result.rows[0];
    } finally {
      dbClient.release();
    }
  }

  /**
   * Get pending booking requests
   */
  async getPendingBookingRequests(): Promise<ClientBookingRequest[]> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<ClientBookingRequest>(
        `SELECT * FROM client_booking_requests 
         WHERE status IN ('pending', 'searching')
         AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY desired_date ASC, created_at ASC`
      );
      return result.rows;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Update booking request status
   */
  async updateBookingRequestStatus(
    requestId: number,
    status: ClientBookingRequest['status'],
    transferId?: number,
    failureReason?: string
  ): Promise<void> {
    const dbClient = await getPool().connect();
    try {
      await dbClient.query(
        `UPDATE client_booking_requests 
         SET 
           status = $2,
           transfer_id = $3,
           failure_reason = $4,
           acquired_at = CASE WHEN $2 = 'acquired' THEN NOW() ELSE acquired_at END,
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           updated_at = NOW()
         WHERE id = $1`,
        [requestId, status, transferId || null, failureReason || null]
      );
    } finally {
      dbClient.release();
    }
  }

  /**
   * Get booking requests for a specific client
   */
  async getClientBookingRequests(clientId: number): Promise<ClientBookingRequest[]> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<ClientBookingRequest>(
        `SELECT * FROM client_booking_requests 
         WHERE client_id = $1 
         ORDER BY created_at DESC`,
        [clientId]
      );
      return result.rows;
    } finally {
      dbClient.release();
    }
  }

  // =====================================================
  // ANALYTICS & STATS
  // =====================================================

  /**
   * Get comprehensive client statistics
   */
  async getStats(): Promise<ClientStats> {
    const dbClient = await getPool().connect();
    try {
      // Get counts
      const countResult = await dbClient.query(`
        SELECT 
          COUNT(*) as total_clients,
          COUNT(*) FILTER (WHERE vip_level = 'vip') as vip_clients,
          COUNT(*) FILTER (WHERE vip_level = 'platinum') as platinum_clients,
          SUM(total_bookings) as total_bookings,
          SUM(total_revenue) as total_revenue
        FROM clients
      `);

      const counts = countResult.rows[0];

      // Get clients by VIP level
      const vipResult = await dbClient.query(`
        SELECT vip_level as level, COUNT(*) as count
        FROM clients
        GROUP BY vip_level
        ORDER BY 
          CASE vip_level 
            WHEN 'platinum' THEN 1 
            WHEN 'vip' THEN 2 
            ELSE 3 
          END
      `);

      // Get top clients by revenue
      const topResult = await dbClient.query<Client>(`
        SELECT * FROM clients
        ORDER BY total_revenue DESC, successful_bookings DESC
        LIMIT 5
      `);

      // Get recent clients
      const recentResult = await dbClient.query<Client>(`
        SELECT * FROM clients
        ORDER BY created_at DESC
        LIMIT 5
      `);

      const totalClients = parseInt(counts.total_clients) || 0;

      return {
        totalClients,
        vipClients: parseInt(counts.vip_clients) || 0,
        platinumClients: parseInt(counts.platinum_clients) || 0,
        totalBookings: parseInt(counts.total_bookings) || 0,
        totalRevenue: parseFloat(counts.total_revenue) || 0,
        avgBookingsPerClient: totalClients > 0 
          ? (parseInt(counts.total_bookings) || 0) / totalClients 
          : 0,
        clientsByVipLevel: vipResult.rows,
        topClients: topResult.rows,
        recentClients: recentResult.rows,
      };
    } finally {
      dbClient.release();
    }
  }

  /**
   * Search clients
   */
  async searchClients(query: string): Promise<Client[]> {
    const dbClient = await getPool().connect();
    try {
      const searchTerm = `%${query.toLowerCase()}%`;
      const result = await dbClient.query<Client>(
        `SELECT * FROM clients 
         WHERE 
           LOWER(first_name) LIKE $1 OR
           LOWER(last_name) LIKE $1 OR
           LOWER(email) LIKE $1 OR
           LOWER(company) LIKE $1
         ORDER BY last_name, first_name
         LIMIT 20`,
        [searchTerm]
      );
      return result.rows;
    } finally {
      dbClient.release();
    }
  }

  /**
   * Get VIP and Platinum clients (priority for sniping)
   */
  async getPriorityClients(): Promise<Client[]> {
    const dbClient = await getPool().connect();
    try {
      const result = await dbClient.query<Client>(
        `SELECT * FROM clients 
         WHERE vip_level IN ('vip', 'platinum')
         ORDER BY 
           CASE vip_level WHEN 'platinum' THEN 1 ELSE 2 END,
           total_revenue DESC`
      );
      return result.rows;
    } finally {
      dbClient.release();
    }
  }
}

export default new ClientManager();

