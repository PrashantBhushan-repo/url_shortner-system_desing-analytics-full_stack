import pool from "../config/db.js";

const run = async () => {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Url'
    `);
    console.log("Url Table Columns in DB:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error querying table columns:", err.message);
  }
  process.exit(0);
};

run();
