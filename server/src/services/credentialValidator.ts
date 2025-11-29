/**
 * Credential Validator Service
 * 
 * Tests platform credentials against live APIs before booking attempts.
 * Validates tokens, sessions, and user information.
 */

import resyClient from './resyApi';
import openTableClient from './openTableApi';
import sevenRoomsClient from './sevenRoomsApi';
import tockClient from './tockApi';
import pool from '../db';

interface ValidationResult {
  platform: string;
  valid: boolean;
  message: string;
  expiresAt?: Date;
  details?: any;
}

interface IdentityCredentials {
  id: number;
  name: string;
  resy_auth_token?: string;
  resy_payment_id?: string;
  opentable_csrf_token?: string;
  opentable_gpid?: string;
  sevenrooms_email?: string;
  sevenrooms_first_name?: string;
  sevenrooms_last_name?: string;
  tock_auth_token?: string;
  tock_email?: string;
}

class CredentialValidator {
  
  /**
   * Validate all credentials for an identity
   */
  async validateIdentity(identityId: number): Promise<{
    identity: string;
    platforms: ValidationResult[];
    overallValid: boolean;
  }> {
    if (!pool) {
      return {
        identity: 'unknown',
        platforms: [],
        overallValid: false,
      };
    }
    
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM booking_identities WHERE id = $1
      `, [identityId]);
      
      if (result.rows.length === 0) {
        return {
          identity: 'not found',
          platforms: [],
          overallValid: false,
        };
      }
      
      const identity = result.rows[0] as IdentityCredentials;
      const platforms: ValidationResult[] = [];
      
      // Validate Resy
      if (identity.resy_auth_token) {
        const resyResult = await this.validateResy(identity.resy_auth_token, identity.resy_payment_id);
        platforms.push(resyResult);
      } else {
        platforms.push({
          platform: 'resy',
          valid: false,
          message: 'No Resy credentials configured',
        });
      }
      
      // Validate OpenTable
      if (identity.opentable_csrf_token) {
        const otResult = await this.validateOpenTable(identity.opentable_csrf_token);
        platforms.push(otResult);
      } else {
        platforms.push({
          platform: 'opentable',
          valid: false,
          message: 'No OpenTable credentials configured',
        });
      }
      
      // Validate SevenRooms
      if (identity.sevenrooms_email) {
        const srResult = await this.validateSevenRooms(identity);
        platforms.push(srResult);
      } else {
        platforms.push({
          platform: 'sevenrooms',
          valid: false,
          message: 'No SevenRooms credentials configured',
        });
      }
      
      // Validate Tock
      if (identity.tock_auth_token) {
        const tockResult = await this.validateTock(identity.tock_auth_token);
        platforms.push(tockResult);
      } else {
        platforms.push({
          platform: 'tock',
          valid: false,
          message: 'No Tock credentials configured',
        });
      }
      
      // Update validation status in database
      const validCount = platforms.filter(p => p.valid).length;
      await client.query(`
        UPDATE booking_identities
        SET 
          last_validated = NOW(),
          validation_status = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [validCount > 0 ? 'partial' : 'invalid', identityId]);
      
      return {
        identity: identity.name,
        platforms,
        overallValid: validCount > 0,
      };
      
    } finally {
      client.release();
    }
  }
  
  /**
   * Validate Resy credentials
   */
  async validateResy(authToken: string, paymentId?: string): Promise<ValidationResult> {
    try {
      // Test by fetching user reservations
      const config = resyClient.isConfigured();
      
      if (!authToken) {
        return {
          platform: 'resy',
          valid: false,
          message: 'Auth token is required',
        };
      }
      
      // Try to get user profile
      const axios = require('axios');
      const response = await axios.get('https://api.resy.com/2/user', {
        headers: {
          'authorization': `ResyAPI api_key="VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5"`,
          'x-resy-auth-token': authToken,
        },
        timeout: 10000,
      });
      
      if (response.status === 200) {
        return {
          platform: 'resy',
          valid: true,
          message: `Valid - User: ${response.data?.first_name || 'Unknown'} ${response.data?.last_name || ''}`.trim(),
          details: {
            userId: response.data?.id,
            email: response.data?.email_address,
            hasPayment: !!paymentId,
          },
        };
      }
      
      return {
        platform: 'resy',
        valid: false,
        message: 'Token validation failed',
      };
      
    } catch (error: any) {
      if (error.response?.status === 401) {
        return {
          platform: 'resy',
          valid: false,
          message: 'Token expired or invalid',
        };
      }
      return {
        platform: 'resy',
        valid: false,
        message: `Validation error: ${error.message}`,
      };
    }
  }
  
  /**
   * Validate OpenTable credentials
   */
  async validateOpenTable(csrfToken: string): Promise<ValidationResult> {
    try {
      // OpenTable tokens are harder to validate without making a booking
      // We can only check if the format looks correct
      
      if (!csrfToken || csrfToken.length < 10) {
        return {
          platform: 'opentable',
          valid: false,
          message: 'Invalid CSRF token format',
        };
      }
      
      // For now, just verify format - actual validation would need
      // to hit their API which requires more complex setup
      return {
        platform: 'opentable',
        valid: true,
        message: 'Token format valid (full validation requires booking attempt)',
        details: {
          tokenLength: csrfToken.length,
          warning: 'Cannot fully validate without booking attempt',
        },
      };
      
    } catch (error: any) {
      return {
        platform: 'opentable',
        valid: false,
        message: `Validation error: ${error.message}`,
      };
    }
  }
  
  /**
   * Validate SevenRooms credentials
   */
  async validateSevenRooms(identity: IdentityCredentials): Promise<ValidationResult> {
    // SevenRooms uses user info, not tokens
    const { sevenrooms_email, sevenrooms_first_name, sevenrooms_last_name } = identity;
    
    if (!sevenrooms_email || !sevenrooms_first_name || !sevenrooms_last_name) {
      return {
        platform: 'sevenrooms',
        valid: false,
        message: 'Missing required fields (email, first name, last name)',
      };
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sevenrooms_email)) {
      return {
        platform: 'sevenrooms',
        valid: false,
        message: 'Invalid email format',
      };
    }
    
    return {
      platform: 'sevenrooms',
      valid: true,
      message: `Valid - ${sevenrooms_first_name} ${sevenrooms_last_name} (${sevenrooms_email})`,
      details: {
        email: sevenrooms_email,
        name: `${sevenrooms_first_name} ${sevenrooms_last_name}`,
      },
    };
  }
  
  /**
   * Validate Tock credentials
   */
  async validateTock(authToken: string): Promise<ValidationResult> {
    try {
      if (!authToken || authToken.length < 10) {
        return {
          platform: 'tock',
          valid: false,
          message: 'Invalid auth token format',
        };
      }
      
      // Similar to OpenTable, full validation requires API call
      return {
        platform: 'tock',
        valid: true,
        message: 'Token format valid (full validation requires booking attempt)',
        details: {
          tokenLength: authToken.length,
          warning: 'Cannot fully validate without booking attempt',
        },
      };
      
    } catch (error: any) {
      return {
        platform: 'tock',
        valid: false,
        message: `Validation error: ${error.message}`,
      };
    }
  }
  
  /**
   * Validate all identities
   */
  async validateAllIdentities(): Promise<Array<{
    id: number;
    name: string;
    validPlatforms: number;
    totalPlatforms: number;
    details: ValidationResult[];
  }>> {
    if (!pool) return [];
    
    const client = await pool.connect();
    try {
      const result = await client.query(`SELECT id FROM booking_identities`);
      const results = [];
      
      for (const row of result.rows) {
        const validation = await this.validateIdentity(row.id);
        const validCount = validation.platforms.filter(p => p.valid).length;
        
        results.push({
          id: row.id,
          name: validation.identity,
          validPlatforms: validCount,
          totalPlatforms: validation.platforms.length,
          details: validation.platforms,
        });
      }
      
      return results;
    } finally {
      client.release();
    }
  }
  
  /**
   * Check if a specific platform is ready for an identity
   */
  async isPlatformReady(identityId: number, platform: string): Promise<boolean> {
    const validation = await this.validateIdentity(identityId);
    const platformResult = validation.platforms.find(p => p.platform === platform);
    return platformResult?.valid || false;
  }
}

export default new CredentialValidator();

