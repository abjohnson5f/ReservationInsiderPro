/**
 * Transfer Tracker Service
 * 
 * Manages the complete lifecycle of reservation transfers:
 * ACQUIRED -> LISTED -> SOLD -> TRANSFER_PENDING -> TRANSFERRED -> COMPLETED
 */

import pool from '../db';

export interface Transfer {
  id: number;
  portfolio_item_id?: string;
  
  // Reservation details
  restaurant_name: string;
  platform: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  confirmation_number?: string;
  
  // AT listing
  at_listing_id?: string;
  at_listing_url?: string;
  listing_price?: number;
  
  // Buyer info
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  sale_price?: number;
  sold_at?: Date;
  
  // Status
  status: 'ACQUIRED' | 'LISTED' | 'SOLD' | 'TRANSFER_PENDING' | 'TRANSFERRED' | 'COMPLETED';
  
  // Transfer details
  transfer_method?: 'NAME_CHANGE' | 'CANCEL_REBOOK' | 'PLATFORM_TRANSFER' | 'SHOW_UP_TOGETHER';
  transfer_deadline?: Date;
  transfer_completed_at?: Date;
  transfer_notes?: string;
  
  booking_identity_id?: number;
  created_at: Date;
  updated_at: Date;
}

export type TransferStatus = Transfer['status'];
export type TransferMethod = NonNullable<Transfer['transfer_method']>;

class TransferTracker {
  
  private getPool() {
    if (!pool) throw new Error('Database pool not initialized');
    return pool;
  }
  
  /**
   * Create a new transfer record when a reservation is acquired
   */
  async createTransfer(data: {
    portfolio_item_id?: string;
    restaurant_name: string;
    platform: string;
    reservation_date: string;
    reservation_time: string;
    party_size: number;
    confirmation_number?: string;
    booking_identity_id?: number;
  }): Promise<Transfer> {
    const result = await this.getPool().query(`
      INSERT INTO transfers (
        portfolio_item_id, restaurant_name, platform,
        reservation_date, reservation_time, party_size,
        confirmation_number, booking_identity_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACQUIRED')
      RETURNING *
    `, [
      data.portfolio_item_id,
      data.restaurant_name,
      data.platform,
      data.reservation_date,
      data.reservation_time,
      data.party_size,
      data.confirmation_number,
      data.booking_identity_id
    ]);
    
    console.log(`[TransferTracker] Created transfer for ${data.restaurant_name}`);
    return result.rows[0];
  }
  
  /**
   * Get all transfers with optional filtering
   */
  async getTransfers(options?: {
    status?: TransferStatus;
    platform?: string;
    upcoming_only?: boolean;
  }): Promise<Transfer[]> {
    let query = 'SELECT * FROM transfers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;
    
    if (options?.status) {
      query += ` AND status = $${paramCount}`;
      params.push(options.status);
      paramCount++;
    }
    
    if (options?.platform) {
      query += ` AND platform = $${paramCount}`;
      params.push(options.platform);
      paramCount++;
    }
    
    if (options?.upcoming_only) {
      query += ` AND reservation_date >= CURRENT_DATE`;
    }
    
    query += ' ORDER BY reservation_date ASC, reservation_time ASC';
    
    const result = await this.getPool().query(query, params);
    return result.rows;
  }
  
  /**
   * Get a single transfer by ID
   */
  async getTransfer(id: number): Promise<Transfer | null> {
    const result = await this.getPool().query(
      'SELECT * FROM transfers WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  /**
   * Mark transfer as listed on AT
   */
  async markAsListed(id: number, data: {
    at_listing_id?: string;
    at_listing_url?: string;
    listing_price: number;
  }): Promise<Transfer | null> {
    const result = await this.getPool().query(`
      UPDATE transfers 
      SET 
        status = 'LISTED',
        at_listing_id = $2,
        at_listing_url = $3,
        listing_price = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, data.at_listing_id, data.at_listing_url, data.listing_price]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Mark transfer as sold
   */
  async markAsSold(id: number, data: {
    buyer_name: string;
    buyer_email?: string;
    buyer_phone?: string;
    sale_price: number;
    transfer_method: TransferMethod;
  }): Promise<Transfer | null> {
    // Calculate transfer deadline (typically 24-48 hours before reservation)
    const transfer = await this.getTransfer(id);
    if (!transfer) return null;
    
    const reservationDate = new Date(`${transfer.reservation_date}T${transfer.reservation_time}`);
    const deadline = new Date(reservationDate);
    deadline.setHours(deadline.getHours() - 24); // 24 hours before
    
    const result = await this.getPool().query(`
      UPDATE transfers 
      SET 
        status = 'SOLD',
        buyer_name = $2,
        buyer_email = $3,
        buyer_phone = $4,
        sale_price = $5,
        transfer_method = $6,
        transfer_deadline = $7,
        sold_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, data.buyer_name, data.buyer_email, data.buyer_phone, data.sale_price, data.transfer_method, deadline]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Mark transfer as pending (buyer notified, waiting for transfer)
   */
  async markAsTransferPending(id: number, notes?: string): Promise<Transfer | null> {
    const result = await this.getPool().query(`
      UPDATE transfers 
      SET 
        status = 'TRANSFER_PENDING',
        transfer_notes = COALESCE($2, transfer_notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, notes]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Mark transfer as transferred
   */
  async markAsTransferred(id: number, notes?: string): Promise<Transfer | null> {
    const result = await this.getPool().query(`
      UPDATE transfers 
      SET 
        status = 'TRANSFERRED',
        transfer_completed_at = NOW(),
        transfer_notes = COALESCE($2, transfer_notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, notes]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Mark transfer as completed (buyer confirmed successful dining)
   */
  async markAsCompleted(id: number): Promise<Transfer | null> {
    const result = await this.getPool().query(`
      UPDATE transfers 
      SET 
        status = 'COMPLETED',
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    return result.rows[0] || null;
  }
  
  /**
   * Get transfers needing action (upcoming deadlines)
   */
  async getTransfersNeedingAction(): Promise<Transfer[]> {
    const result = await this.getPool().query(`
      SELECT * FROM transfers 
      WHERE status IN ('SOLD', 'TRANSFER_PENDING')
        AND transfer_deadline IS NOT NULL
        AND transfer_deadline <= NOW() + INTERVAL '48 hours'
      ORDER BY transfer_deadline ASC
    `);
    return result.rows;
  }
  
  /**
   * Get revenue statistics
   */
  async getRevenueStats(options?: {
    start_date?: string;
    end_date?: string;
  }): Promise<{
    total_sales: number;
    total_revenue: number;
    avg_sale_price: number;
    by_platform: Record<string, { count: number; revenue: number }>;
    by_status: Record<string, number>;
  }> {
    let dateFilter = '';
    const params: any[] = [];
    
    if (options?.start_date) {
      params.push(options.start_date);
      dateFilter += ` AND sold_at >= $${params.length}`;
    }
    if (options?.end_date) {
      params.push(options.end_date);
      dateFilter += ` AND sold_at <= $${params.length}`;
    }
    
    // Total stats
    const totalResult = await this.getPool().query(`
      SELECT 
        COUNT(*) FILTER (WHERE sale_price IS NOT NULL) as total_sales,
        COALESCE(SUM(sale_price), 0) as total_revenue,
        COALESCE(AVG(sale_price) FILTER (WHERE sale_price IS NOT NULL), 0) as avg_sale_price
      FROM transfers
      WHERE 1=1 ${dateFilter}
    `, params);
    
    // By platform
    const platformResult = await this.getPool().query(`
      SELECT 
        platform,
        COUNT(*) FILTER (WHERE sale_price IS NOT NULL) as count,
        COALESCE(SUM(sale_price), 0) as revenue
      FROM transfers
      WHERE 1=1 ${dateFilter}
      GROUP BY platform
    `, params);
    
    // By status
    const statusResult = await this.getPool().query(`
      SELECT status, COUNT(*) as count
      FROM transfers
      GROUP BY status
    `);
    
    const byPlatform: Record<string, { count: number; revenue: number }> = {};
    platformResult.rows.forEach(row => {
      byPlatform[row.platform] = {
        count: parseInt(row.count),
        revenue: parseFloat(row.revenue)
      };
    });
    
    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach(row => {
      byStatus[row.status] = parseInt(row.count);
    });
    
    return {
      total_sales: parseInt(totalResult.rows[0].total_sales),
      total_revenue: parseFloat(totalResult.rows[0].total_revenue),
      avg_sale_price: parseFloat(totalResult.rows[0].avg_sale_price),
      by_platform: byPlatform,
      by_status: byStatus
    };
  }
  
  /**
   * Generate AT-ready listing description
   */
  generateATListing(transfer: Transfer): {
    title: string;
    description: string;
    price_suggestion: number;
  } {
    const dateObj = new Date(transfer.reservation_date);
    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    // Convert 24hr time to 12hr format
    const [hours, minutes] = transfer.reservation_time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const formattedTime = `${hour12}:${minutes} ${ampm}`;
    
    // Price suggestion based on restaurant tier (you'd adjust this)
    const basePrices: Record<string, number> = {
      'resy': 150,
      'opentable': 100,
      'sevenrooms': 200,
      'tock': 250
    };
    const priceSuggestion = basePrices[transfer.platform.toLowerCase()] || 150;
    
    return {
      title: `${transfer.restaurant_name} - ${dayOfWeek} ${formattedDate} @ ${formattedTime} (${transfer.party_size} guests)`,
      description: `
📍 ${transfer.restaurant_name}
📅 ${dayOfWeek}, ${formattedDate}
⏰ ${formattedTime}
👥 Party of ${transfer.party_size}
📱 Platform: ${transfer.platform}

✅ Confirmed reservation
💳 Transfer via ${transfer.platform === 'Resy' ? 'Resy name change' : 'coordination with seller'}

Message me to arrange transfer. Quick response guaranteed!
      `.trim(),
      price_suggestion: priceSuggestion
    };
  }
  
  /**
   * Delete a transfer
   */
  async deleteTransfer(id: number): Promise<boolean> {
    const result = await this.getPool().query(
      'DELETE FROM transfers WHERE id = $1',
      [id]
    );
    return (result.rowCount || 0) > 0;
  }
}

export default new TransferTracker();

