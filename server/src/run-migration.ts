/**
 * Migration Runner
 * Run a specific migration by passing its number
 * Usage: npx ts-node src/run-migration.ts 005
 */

import pool from './db';
import * as migration005 from './migrations/005_clients_and_concierge';

async function runMigration() {
  const migrationNumber = process.argv[2] || '005';
  
  console.log(`\n🔄 Running migration ${migrationNumber}...\n`);
  
  if (!pool) {
    console.error('❌ Database pool not initialized. Check your DATABASE_URL.');
    process.exit(1);
  }
  
  try {
    let migration: { up: string; down: string };
    
    switch (migrationNumber) {
      case '005':
        migration = migration005;
        break;
      default:
        console.error(`❌ Unknown migration: ${migrationNumber}`);
        process.exit(1);
    }
    
    console.log('📝 Executing migration SQL...\n');
    console.log('--- SQL ---');
    console.log(migration.up.substring(0, 500) + '...');
    console.log('--- END SQL ---\n');
    
    await pool.query(migration.up);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('clients', 'client_booking_requests')
    `);
    
    console.log('📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Show some schema info
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'clients' 
      ORDER BY ordinal_position
      LIMIT 10
    `);
    
    console.log('\n📝 clients table columns (first 10):');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Connection closed.');
  }
}

runMigration();

