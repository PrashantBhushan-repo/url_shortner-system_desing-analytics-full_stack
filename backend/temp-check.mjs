import pool from './src/config/db.js';

const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM "Click" WHERE url_id = 27');
const hourlyResult = await pool.query('SELECT COUNT(*)::int AS count FROM "UrlStatsHourly" WHERE url_id = 27');
const dailyResult = await pool.query('SELECT COUNT(*)::int AS count FROM "UrlStatsDaily" WHERE url_id = 27');

console.log(JSON.stringify({ clickCount: countResult.rows[0].count, hourlyCount: hourlyResult.rows[0].count, dailyCount: dailyResult.rows[0].count }, null, 2));
await pool.end();
