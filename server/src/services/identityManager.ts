/**
 * Identity Manager Service
 * 
 * Manages multiple booking identities for platform rotation.
 * Tracks usage per identity and auto-selects the best identity
 * for each booking to stay under platform detection thresholds.
 */

import pool from '../db';

export interface BookingIdentity {
  id: number;
  name: string;
  email: string;
  phone?: string;
  
  // Resy
  resy_auth_token?: string;
  resy_payment_id?: string;
  resy_api_key?: string;
  
  // OpenTable
  opentable_csrf_token?: string;
  opentable_session_cookie?: string;
  opentable_gpid?: string;
  
  // SevenRooms
  sevenrooms_first_name?: string;
  sevenrooms_last_name?: string;
  sevenrooms_email?: string;
  sevenrooms_phone?: string;
  
  // Tock
  tock_auth_token?: string;
  tock_email?: string;
  tock_phone?: string;
  
  // Usage
  bookings_this_month: number;
  resy_bookings_month: number;
  opentable_bookings_month: number;
  sevenrooms_bookings_month: number;
  tock_bookings_month: number;
  monthly_limit: number;
  last_booking_date?: Date;
  is_active: boolean;
}

type Platform = 'resy' | 'opentable' | 'sevenrooms' | 'tock';

class IdentityManager {
  
  /**
   * Get all active identities
   */
  async getAllIdentities(): Promise<BookingIdentity[]> {
    if (!pool) throw new Error('Database pool not initialized');
    const result = await pool.query(
      'SELECT * FROM booking_identities WHERE is_active = true ORDER BY name'
    );
    return result.rows;
  }
  
  /**
   * Get a specific identity by ID
   */
  async getIdentity(id: number): Promise<BookingIdentity | null> {
    if (!pool) throw new Error('Database pool not initialized');
    const result = await pool.query(
      'SELECT * FROM booking_identities WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
  
  /**
   * Get the best identity for a specific platform
   * Selects the identity with the lowest usage for that platform
   */
  async getBestIdentityForPlatform(platform: Platform): Promise<BookingIdentity | null> {
    if (!pool) throw new Error('Database pool not initialized');
    
    const columnMap: Record<Platform, string> = {
      resy: 'resy_bookings_month',
      opentable: 'opentable_bookings_month',
      sevenrooms: 'sevenrooms_bookings_month',
      tock: 'tock_bookings_month'
    };
    
    const credentialChecks: Record<Platform, string> = {
      resy: 'resy_auth_token IS NOT NULL',
      opentable: 'opentable_csrf_token IS NOT NULL',
      sevenrooms: 'sevenrooms_email IS NOT NULL',
      tock: 'tock_auth_token IS NOT NULL'
    };
    
    const usageColumn = columnMap[platform];
    const credCheck = credentialChecks[platform];
    
    const result = await pool.query(`
      SELECT * FROM booking_identities 
      WHERE is_active = true 
        AND ${credCheck}
        AND ${usageColumn} < monthly_limit
      ORDER BY ${usageColumn} ASC, last_booking_date ASC NULLS FIRST
      LIMIT 1
    `);
    
    return result.rows[0] || null;
  }
  
  /**
   * Get credentials for a specific platform from an identity
   */
  getPlatformCredentials(identity: BookingIdentity, platform: Platform): Record<string, string> {
    switch (platform) {
      case 'resy':
        return {
          authToken: identity.resy_auth_token || '',
          paymentId: identity.resy_payment_id || '',
          apiKey: identity.resy_api_key || 'VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5'
        };
      case 'opentable':
        return {
          csrfToken: identity.opentable_csrf_token || '',
          sessionCookie: identity.opentable_session_cookie || '',
          gpid: identity.opentable_gpid || ''
        };
      case 'sevenrooms':
        return {
          firstName: identity.sevenrooms_first_name || '',
          lastName: identity.sevenrooms_last_name || '',
          email: identity.sevenrooms_email || '',
          phone: identity.sevenrooms_phone || ''
        };
      case 'tock':
        return {
          authToken: identity.tock_auth_token || '',
          email: identity.tock_email || '',
          phone: identity.tock_phone || ''
        };
      default:
        return {};
    }
  }
  
  /**
   * Record a successful booking for an identity
   */
  async recordBooking(identityId: number, platform: Platform): Promise<void> {
    if (!pool) throw new Error('Database pool not initialized');
    
    const columnMap: Record<Platform, string> = {
      resy: 'resy_bookings_month',
      opentable: 'opentable_bookings_month',
      sevenrooms: 'sevenrooms_bookings_month',
      tock: 'tock_bookings_month'
    };
    
    const usageColumn = columnMap[platform];
    
    await pool.query(`
      UPDATE booking_identities 
      SET 
        bookings_this_month = bookings_this_month + 1,
        ${usageColumn} = ${usageColumn} + 1,
        last_booking_date = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [identityId]);
    
    console.log(`[IdentityManager] Recorded booking for identity ${identityId} on ${platform}`);
  }
  
  /**
   * Create a new identity
   */
  async createIdentity(data: Partial<BookingIdentity>): Promise<BookingIdentity> {
    if (!pool) throw new Error('Database pool not initialized');
    const result = await pool.query(`
      INSERT INTO booking_identities (
        name, email, phone,
        resy_auth_token, resy_payment_id, resy_api_key,
        opentable_csrf_token, opentable_session_cookie, opentable_gpid,
        sevenrooms_first_name, sevenrooms_last_name, sevenrooms_email, sevenrooms_phone,
        tock_auth_token, tock_email, tock_phone,
        monthly_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      data.name,
      data.email,
      data.phone,
      data.resy_auth_token,
      data.resy_payment_id,
      data.resy_api_key || 'VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5',
      data.opentable_csrf_token,
      data.opentable_session_cookie,
      data.opentable_gpid,
      data.sevenrooms_first_name,
      data.sevenrooms_last_name,
      data.sevenrooms_email,
      data.sevenrooms_phone,
      data.tock_auth_token,
      data.tock_email,
      data.tock_phone,
      data.monthly_limit || 6
    ]);
    
    console.log(`[IdentityManager] Created new identity: ${data.name}`);
    return result.rows[0];
  }
  
  /**
   * Update an existing identity
   */
  async updateIdentity(id: number, data: Partial<BookingIdentity>): Promise<BookingIdentity | null> {
    if (!pool) throw new Error('Database pool not initialized');
    
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;
    
    const allowedFields = [
      'name', 'email', 'phone',
      'resy_auth_token', 'resy_payment_id', 'resy_api_key',
      'opentable_csrf_token', 'opentable_session_cookie', 'opentable_gpid',
      'sevenrooms_first_name', 'sevenrooms_last_name', 'sevenrooms_email', 'sevenrooms_phone',
      'tock_auth_token', 'tock_email', 'tock_phone',
      'monthly_limit', 'is_active'
    ];
    
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (fields.length === 0) return null;
    
    fields.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await pool.query(`
      UPDATE booking_identities 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    return result.rows[0] || null;
  }
  
  /**
   * Delete an identity (soft delete by setting inactive)
   */
  async deleteIdentity(id: number): Promise<boolean> {
    if (!pool) throw new Error('Database pool not initialized');
    const result = await pool.query(`
      UPDATE booking_identities 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [id]);
    return (result.rowCount || 0) > 0;
  }
  
  /**
   * Get usage statistics for all identities
   */
  async getUsageStats(): Promise<{
    identity: string;
    total: number;
    resy: number;
    opentable: number;
    sevenrooms: number;
    tock: number;
    limit: number;
    remaining: number;
  }[]> {
    if (!pool) throw new Error('Database pool not initialized');
    const result = await pool.query(`
      SELECT 
        name,
        bookings_this_month as total,
        resy_bookings_month as resy,
        opentable_bookings_month as opentable,
        sevenrooms_bookings_month as sevenrooms,
        tock_bookings_month as tock,
        monthly_limit as limit,
        (monthly_limit * 4) - bookings_this_month as remaining
      FROM booking_identities 
      WHERE is_active = true
      ORDER BY name
    `);
    
    return result.rows.map(row => ({
      identity: row.name,
      total: row.total,
      resy: row.resy,
      opentable: row.opentable,
      sevenrooms: row.sevenrooms,
      tock: row.tock,
      limit: row.limit,
      remaining: row.remaining
    }));
  }
  
  /**
   * Reset monthly counts (should be called on 1st of each month)
   */
  async resetMonthlyCounts(): Promise<void> {
    if (!pool) throw new Error('Database pool not initialized');
    await pool.query(`
      UPDATE booking_identities 
      SET 
        bookings_this_month = 0,
        resy_bookings_month = 0,
        opentable_bookings_month = 0,
        sevenrooms_bookings_month = 0,
        tock_bookings_month = 0,
        updated_at = NOW()
    `);
    console.log('[IdentityManager] Reset all monthly booking counts');
  }
  
  /**
   * Check if any identity has capacity for a platform
   */
  async hasCapacity(platform: Platform): Promise<boolean> {
    const identity = await this.getBestIdentityForPlatform(platform);
    return identity !== null;
  }
  
  /**
   * Get platform configuration status for an identity
   */
  getConfiguredPlatforms(identity: BookingIdentity): Record<Platform, boolean> {
    return {
      resy: !!identity.resy_auth_token,
      opentable: !!identity.opentable_csrf_token,
      sevenrooms: !!identity.sevenrooms_email,
      tock: !!identity.tock_auth_token
    };
  }
}

export default new IdentityManager();

