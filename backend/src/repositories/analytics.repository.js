import pool from "../config/db.js";

/**
 * Store every click for analytics
 */
export const saveClickAnalytics = async ({
  urlId,
  visitorId,
  ipAddress,
  browser,
  browserVersion,
  operatingSystem,
  osVersion,
  deviceType,
  deviceName,
  platform,
  userAgent,
  country,
  state,
  city,
  latitude,
  longitude,
  timezone,
  referrer,
  refererHost,
  utmSource,
  utmMedium,
  utmCampaign,
  isQrScan,
  isUnique,
  sessionId,
  language,
  screenResolution,
  networkType,
}) => {

  const query = `
  INSERT INTO clicks(

      url_id,

      visitor_id,

      ip_address,

      browser,

      browser_version,

      operating_system,

      os_version,

      device_type,

      device_name,

      platform,

      user_agent,

      country,

      state,

      city,

      latitude,

      longitude,

      timezone,

      referrer,

      referer_host,

      utm_source,

      utm_medium,

      utm_campaign,

      is_qr_scan,

      is_unique,

      session_id,

      language,

      screen_resolution,

      network_type

  )

  VALUES(

      $1,$2,$3,$4,$5,$6,$7,$8,$9,

      $10,$11,$12,$13,$14,$15,$16,

      $17,$18,$19,$20,$21,$22,

      $23,$24,$25,$26,$27,$28

  )

  RETURNING *;
  `;

  const values = [

    urlId,

    visitorId,

    ipAddress,

    browser,

    browserVersion,

    operatingSystem,

    osVersion,

    deviceType,

    deviceName,

    platform,

    userAgent,

    country,

    state,

    city,

    latitude,

    longitude,

    timezone,

    referrer,

    refererHost,

    utmSource,

    utmMedium,

    utmCampaign,

    isQrScan,

    isUnique,

    sessionId,

    language,

    screenResolution,

    networkType,

  ];

  const result = await pool.query(query, values);

  return result.rows[0];

};










// added :



// import pool from "../config/db.js";

/*
------------------------------------------
Overview Analytics
------------------------------------------
*/

export const getOverviewAnalytics = async () => {

    const query = `

    SELECT

    (SELECT COUNT(*) FROM urls) AS total_urls,

    (SELECT COALESCE(SUM(clicks),0) FROM urls) AS total_clicks,

    (SELECT COUNT(DISTINCT visitor_id) FROM clicks) AS unique_visitors,

    (

        SELECT COUNT(*)

        FROM clicks

        WHERE clicked_at >= CURRENT_DATE

    ) AS today_clicks,

    (

        SELECT COUNT(*)

        FROM clicks

        WHERE clicked_at >= NOW() - INTERVAL '24 HOURS'

    ) AS last_24_hours,

    (

        SELECT COUNT(*)

        FROM clicks

        WHERE clicked_at >= NOW() - INTERVAL '7 DAYS'

    ) AS last_7_days,

    (

        SELECT COUNT(*)

        FROM clicks

        WHERE clicked_at >= NOW() - INTERVAL '30 DAYS'

    ) AS last_30_days,

    (

        SELECT COUNT(*)

        FROM clicks

        WHERE is_qr_scan = true

    ) AS qr_scans;

    `;

    const result = await pool.query(query);

    return result.rows[0];

};