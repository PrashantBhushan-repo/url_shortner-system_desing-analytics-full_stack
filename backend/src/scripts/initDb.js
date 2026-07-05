import pool from "../config/db.js";

const createTable = async () => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS urls (
        id UUID PRIMARY KEY,
        long_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        clicks INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    await pool.query(query);
    console.log("Table 'urls' ensured.");
  } catch (err) {
    console.error("Failed to create 'urls' table:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

createTable();
