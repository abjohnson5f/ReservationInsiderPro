import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try to locate .env
const envPath1 = path.resolve(__dirname, '../../.env'); // If running from server/src
const envPath2 = path.resolve(__dirname, '../../../.env'); // If running from server/dist
const envPath3 = path.resolve(process.cwd(), '../../.env'); // If running from root

let loaded = false;
if (fs.existsSync(envPath1)) {
    dotenv.config({ path: envPath1 });
    loaded = true;
} else if (fs.existsSync(envPath2)) {
    dotenv.config({ path: envPath2 });
    loaded = true;
} else if (fs.existsSync(envPath3)) {
    dotenv.config({ path: envPath3 });
    loaded = true;
} else {
    // Fallback: maybe it's already loaded in process.env
    dotenv.config();
}

let pool: Pool | null = null;

if (!process.env.NEON_DATABASE_URL) {
  console.warn('⚠️ Warning: NEON_DATABASE_URL is not defined.');
  console.warn('   Database features will be disabled.');
  console.warn('   Checked paths:');
  console.warn('   1:', envPath1, fs.existsSync(envPath1) ? '(Found)' : '(Missing)');
  console.warn('   2:', envPath2, fs.existsSync(envPath2) ? '(Found)' : '(Missing)');
  console.warn('   3:', envPath3, fs.existsSync(envPath3) ? '(Found)' : '(Missing)');
} else {
  pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: {
      rejectUnauthorized: true // Neon requires SSL
    }
  });

  // Test connection
  pool.on('connect', () => {
    console.log('✅ Connected to Neon Postgres');
  });

  pool.on('error', (err) => {
    console.error('❌ Unexpected error on idle client', err);
  });
}

export default pool;
