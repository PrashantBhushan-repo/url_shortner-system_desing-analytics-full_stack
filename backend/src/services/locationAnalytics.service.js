import prisma from '../config/prismaClient.js';
import { analyticsWindow } from '../utils/analyticsWindow.js';
import { AppError } from '../utils/AppError.js';

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryNames = Array.from({ length: 26 * 26 }, (_, index) => String.fromCharCode(65 + Math.floor(index / 26), 65 + index % 26)).map(code => ({ code, name: displayNames.of(code).toLowerCase() })).filter(item => item.name !== item.code.toLowerCase());

export function locationQuery(query, detail = false) {
  if (query.range !== undefined && !['24h', '7d', '30d'].includes(query.range)) throw new AppError('Invalid reporting period', 400);
  const page = Number(query.page ?? 1);
  if ((query.page !== undefined && !['string', 'number'].includes(typeof query.page)) || !Number.isSafeInteger(page) || page < 1 || page > 100000) throw new AppError('Invalid location page', 400);
  const search = query.search ?? '';
  if (typeof search !== 'string' || search.length > 100) throw new AppError('Search must be at most 100 characters', 400);
  const result = { page, pageSize: 25, search: search.trim() };
  for (const key of ['country', 'state', 'city']) {
    const value = query[key];
    if (value !== undefined && (typeof value !== 'string' || !value.trim() || value.length > 150)) throw new AppError(`Invalid ${key}`, 400);
    result[key] = value?.trim() ?? null;
    if (detail && !result[key]) throw new AppError('Country, state and city are required', 400);
  }
  if (detail) result.search = '';
  return result;
}

export async function getLocationReport(urlId, range, cutoff, options, detail = false) {
  const { start, end } = analyticsWindow(range, cutoff);
  const { page, pageSize, search, country, state, city } = options;
  const offset = (page - 1) * pageSize;
  const countryMatches = search ? countryNames.filter(item => item.name.includes(search.toLowerCase())).map(item => item.code) : [];
  const [summary] = await prisma.$queryRaw`
    WITH locations AS (
      SELECT *, COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS geo_country,
        COALESCE(NULLIF(TRIM(state), ''), 'Unknown') AS geo_state,
        COALESCE(NULLIF(TRIM(city), ''), 'Unknown') AS geo_city
      FROM "Click" WHERE url_id = ${BigInt(urlId)} AND clicked_at >= ${start} AND clicked_at <= ${end}
    )
    SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) FILTER (WHERE NOT is_bot) AS visitors,
      COUNT(*) FILTER (WHERE is_bot) AS bots, COUNT(*) FILTER (WHERE is_qr_scan) AS scans,
      COUNT(DISTINCT (geo_country, geo_state, geo_city)) AS places,
      COUNT(*) FILTER (WHERE geo_city <> 'Unknown') AS located
    FROM locations WHERE (${country}::text IS NULL OR geo_country = ${country})
      AND (${state}::text IS NULL OR geo_state = ${state}) AND (${city}::text IS NULL OR geo_city = ${city})
      AND (strpos(lower(concat_ws(' ', geo_country, geo_state, geo_city)), lower(${search})) > 0 OR geo_country = ANY(${countryMatches}::text[]))
  `;
  let rows;
  if (detail) {
    rows = await prisma.$queryRaw`
      SELECT id, clicked_at, country, state, city, timezone, device_type, browser, operating_system, referer_host, is_bot, is_qr_scan
      FROM "Click" WHERE url_id = ${BigInt(urlId)} AND clicked_at >= ${start} AND clicked_at <= ${end}
        AND COALESCE(NULLIF(TRIM(country), ''), 'Unknown') = ${country}
        AND COALESCE(NULLIF(TRIM(state), ''), 'Unknown') = ${state}
        AND COALESCE(NULLIF(TRIM(city), ''), 'Unknown') = ${city}
      ORDER BY clicked_at DESC, id DESC LIMIT ${pageSize} OFFSET ${offset}
    `;
    rows = rows.map(row => ({ id: String(row.id), clickedAt: row.clicked_at.toISOString(), country: row.country?.trim() || 'Unknown', state: row.state?.trim() || 'Unknown', city: row.city?.trim() || 'Unknown', timezone: row.timezone || 'Unknown', device: row.device_type || 'Unknown', browser: row.browser || 'Unknown', os: row.operating_system || 'Unknown', referrer: row.referer_host || 'Direct', isBot: row.is_bot, isQrScan: row.is_qr_scan }));
  } else {
    rows = await prisma.$queryRaw`
      WITH locations AS (
        SELECT visitor_id, is_bot, clicked_at, COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS country,
          COALESCE(NULLIF(TRIM(state), ''), 'Unknown') AS state, COALESCE(NULLIF(TRIM(city), ''), 'Unknown') AS city
        FROM "Click" WHERE url_id = ${BigInt(urlId)} AND clicked_at >= ${start} AND clicked_at <= ${end}
      )
      SELECT country, state, city, COUNT(*) AS clicks, COUNT(DISTINCT visitor_id) FILTER (WHERE NOT is_bot) AS visitors, MAX(clicked_at) AS last_click
      FROM locations WHERE (${country}::text IS NULL OR country = ${country})
        AND (${state}::text IS NULL OR state = ${state}) AND (${city}::text IS NULL OR city = ${city})
        AND (strpos(lower(concat_ws(' ', country, state, city)), lower(${search})) > 0 OR country = ANY(${countryMatches}::text[]))
      GROUP BY country, state, city ORDER BY clicks DESC, country, state, city LIMIT ${pageSize} OFFSET ${offset}
    `;
    rows = rows.map(row => ({ country: row.country, state: row.state, city: row.city, clicks: Number(row.clicks), uniqueVisitors: Number(row.visitors), lastClick: row.last_click.toISOString() }));
  }
  return { rows, page, pageSize, totalRows: Number(detail ? summary.clicks : summary.places), totalClicks: Number(summary.clicks), uniqueVisitors: Number(summary.visitors), botClicks: Number(summary.bots), qrScans: Number(summary.scans), locatedClicks: Number(summary.located), period: { start: start.toISOString(), end: end.toISOString() } };
}
