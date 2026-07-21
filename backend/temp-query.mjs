import pool from './src/config/db.js';
const countResult = await pool.query('SELECT COUNT(*)::int AS count FROM "Click" WHERE url_id = 27');
const latestResult = await pool.query('SELECT id, url_id, browser, country, is_bot, clicked_at FROM "Click" WHERE url_id = 27 ORDER BY clicked_at DESC LIMIT 3');
console.log(JSON.stringify({count: countResult.rows[0].count, latest: latestResult.rows}, null, 2));
await pool.end();
