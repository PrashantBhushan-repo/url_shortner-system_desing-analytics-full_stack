import pool from "../config/db.js";

async function alterColumn() {
  try {
    await pool.query('ALTER TABLE "Url" ALTER COLUMN short_code TYPE VARCHAR(64);');
    console.log("✅ Successfully altered short_code to VARCHAR(64) in PostgreSQL");
  } catch (err) {
    console.error("❌ Error altering column:", err.message);
  } finally {
    await pool.end();
  }
}

alterColumn();
