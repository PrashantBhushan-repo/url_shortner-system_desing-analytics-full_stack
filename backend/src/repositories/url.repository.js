import pool from "../config/db.js";

/**
 * Create a new URL entry in the database
 * @param {string} longUrl - The original long URL
 * @param {string} shortCode - The short code (generated or custom)
 * @param {boolean} customAlias - Whether this is a custom alias
 * @param {string|null} expiresAt - Optional expiration timestamp
 * @returns {Promise<Object>} - The created URL record
 */
export const createUrl = async (longUrl, shortCode, customAlias = false, expiresAt = null, userId = null) => {
  const query = `
    INSERT INTO "Url" (long_url, short_code, custom_alias, expires_at, is_active, user_id)
    VALUES ($1, $2, $3, $4, true, $5)
    RETURNING *
  `;

  const result = await pool.query(query, [longUrl, shortCode, customAlias, expiresAt, userId]);
  return result.rows[0];
};

/**
 * Find a URL by its short code
 * @param {string} shortCode - The short code to look up
 * @returns {Promise<Object|null>} - The URL record or null if not found
 */
export const findByShortCode = async (shortCode) => {
  const result = await pool.query(
    `
      SELECT *
      FROM "Url"
      WHERE short_code = $1
    `,
    [shortCode]
  );

  return result.rows[0];
};

export const findByShortCodeForUser = async (shortCode, userId, role) => {
  const result = await pool.query(
    `
      SELECT *
      FROM "Url"
      WHERE short_code = $1 AND ($2 = 'ADMIN' OR user_id = $3)
    `,
    [shortCode, role, userId]
  );

  return result.rows[0];
};

/**
 * Check if a short code already exists (for custom alias validation)
 * @param {string} shortCode - The short code to check
 * @returns {Promise<boolean>} - True if the short code exists
 */
export const shortCodeExists = async (shortCode) => {
  const result = await pool.query(
    `
      SELECT id
      FROM "Url"
      WHERE short_code = $1
      LIMIT 1
    `,
    [shortCode]
  );

  return result.rows.length > 0;
};

/**
 * Update a URL
 * @param {string} shortCode - The short code to update
 * @param {string} longUrl - New long URL
 * @param {string} updatedShortCode - New short code
 * @param {boolean} customAlias - Whether it's custom
 * @param {string|null} expiresAt - Expiration date
 * @returns {Promise<Object|null>} - Updated URL record
 */
export const updateUrl = async (shortCode, longUrl, updatedShortCode, customAlias, expiresAt, userId = null, role = "USER") => {
  const result = await pool.query(
    `
      UPDATE "Url"
      SET long_url = $2,
          short_code = $3,
          custom_alias = $4,
          expires_at = $5
      WHERE short_code = $1 AND is_active = true AND ($6 = 'ADMIN' OR user_id = $7)
      RETURNING *
    `,
    [shortCode, longUrl, updatedShortCode, customAlias, expiresAt, role, userId]
  );

  return result.rows[0] || null;
};

/**
 * Deactivate a URL (soft delete)
 * @param {string} shortCode - The short code to deactivate
 * @returns {Promise<boolean>} - True if deactivated
 */
export const deactivateUrl = async (shortCode, userId = null, role = "USER") => {
  const result = await pool.query(
    `
      UPDATE "Url"
      SET is_active = false
      WHERE short_code = $1 AND is_active = true AND ($2 = 'ADMIN' OR user_id = $3)
      RETURNING id
    `,
    [shortCode, role, userId]
  );

  return result.rows.length > 0;
};

export const listUrlsForUser = async (userId = null, role = "USER") => {
  const result = await pool.query(
    `
      SELECT *
      FROM "Url"
      WHERE $2 = 'ADMIN' OR user_id = $1
      ORDER BY created_at DESC
    `,
    [userId, role]
  );

  return result.rows;
};
