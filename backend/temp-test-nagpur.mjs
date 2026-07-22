import pool from './src/config/db.js';
import { addClickJob } from './src/queues/clickQueue.js';
import { getUrlGeo } from './src/services/analytics.service.js';

const run = async () => {
  console.log("Enqueuing test click with loopback IP 127.0.0.1...");
  await addClickJob({
    urlId: 28,
    ip: '127.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    referrer: 'https://www.linkedin.com/feed/',
    sessionId: 'sess_nagpur_test',
    isQrScan: false,
    timestamp: new Date().toISOString(),
  });

  console.log("Job enqueued. Waiting 5 seconds for worker to process and fetch GeoIP...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Query database records for URL 28
  const details = await pool.query(`
    SELECT id, browser, operating_system, device_type, referer_host, country, city
    FROM "Click"
    WHERE url_id = 28 AND session_id = 'sess_nagpur_test'
    ORDER BY id DESC
    LIMIT 1
  `);
  console.log("Database record saved:");
  console.log(details.rows);

  console.log("Calling getUrlGeo...");
  const geoResult = await getUrlGeo(28, '7d');
  console.log("Geo service result:", geoResult);

  await pool.end();
};

run().catch(console.error);
