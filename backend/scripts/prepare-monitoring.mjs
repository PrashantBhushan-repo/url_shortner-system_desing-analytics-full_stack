// Run once per monitoring-password change using the migration image.
import '../src/config/config.js';
import pg from 'pg';
const password = process.env.OBS_POSTGRES_PASSWORD;
if (!/^[0-9a-f]{64}$/.test(password || '')) throw new Error('Monitoring password must be 64 lowercase hexadecimal characters');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'pburls_monitor'");
  if (!exists.rowCount) await client.query('CREATE ROLE pburls_monitor LOGIN');
  // Password is strictly validated above and cannot contain SQL syntax.
  await client.query(`ALTER ROLE pburls_monitor WITH LOGIN PASSWORD '${password}'`);
  await client.query('GRANT pg_monitor TO pburls_monitor');
  await client.query('COMMIT');
  console.log('Read-only PostgreSQL monitoring role configured.');
} catch {
  await client.query('ROLLBACK');
  throw new Error('Could not configure PostgreSQL monitoring role');
} finally { await client.end(); }
