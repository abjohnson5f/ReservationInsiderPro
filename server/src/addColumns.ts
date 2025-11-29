import pool from './db';

async function addColumns() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding new columns to portfolio_items...');
    
    await client.query('BEGIN');
    
    // Add new columns if they don't exist
    await client.query(`
      ALTER TABLE portfolio_items 
      ADD COLUMN IF NOT EXISTS next_drop_date DATE,
      ADD COLUMN IF NOT EXISTS next_drop_time TIME,
      ADD COLUMN IF NOT EXISTS drop_timezone TEXT;
    `);
    
    await client.query('COMMIT');
    console.log('✅ Schema updated successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns();











