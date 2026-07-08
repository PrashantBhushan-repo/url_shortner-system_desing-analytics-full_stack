import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.db.connectionString || undefined,
  host: config.db.connectionString ? undefined : config.db.host,
  port: config.db.connectionString ? undefined : config.db.port,
  database: config.db.connectionString ? undefined : config.db.name,
  user: config.db.connectionString ? undefined : config.db.user,
  password: config.db.connectionString ? undefined : config.db.password,
});

export default pool;