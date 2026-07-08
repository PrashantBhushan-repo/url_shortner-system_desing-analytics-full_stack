import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(__dirname, "../../migrations/001_create_urls_table.sql");

const runMigration = async () => {
  try {
    const sql = fs.readFileSync(migrationPath, "utf8");
    await pool.query(sql);
    console.log("Migration applied: 001_create_urls_table.sql");
  } catch (err) {
    console.error("Failed to run migration:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runMigration();
