import pool from "../config/db.js";

const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id UUID PRIMARY KEY,
        long_url TEXT NOT NULL,
        short_code VARCHAR(12) UNIQUE NOT NULL,
        clicks INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      ALTER TABLE urls
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_created_at ON urls(created_at);
    `);

    console.log("Table 'urls' ensured with indexes.");
  } catch (err) {
    console.error("Failed to initialize database:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

createTable();
