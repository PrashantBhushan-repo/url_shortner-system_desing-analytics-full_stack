import pool from "../config/db.js";

/**
 * Create a new URL entry in the database
 * @param {string} longUrl - The original long URL
 * @param {string} shortCode - The short code (generated or custom)
 * @param {boolean} customAlias - Whether this is a custom alias
 * @param {string|null} expiresAt - Optional expiration timestamp
 * @returns {Promise<Object>} - The created URL record
 */
export const createUrl = async (longUrl, shortCode, customAlias = false, expiresAt = null) => {
  const query = `
    INSERT INTO urls (long_url, short_code, custom_alias, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;

  const result = await pool.query(query, [longUrl, shortCode, customAlias, expiresAt]);
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
      FROM urls
      WHERE short_code = $1
    `,
    [shortCode]
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
      FROM urls
      WHERE short_code = $1
      LIMIT 1
    `,
    [shortCode]
  );

  return result.rows.length > 0;
};

/**
 * Deactivate a URL (soft delete)
 * @param {string} shortCode - The short code to deactivate
 * @returns {Promise<boolean>} - True if the URL was deactivated
 */
export const deactivateUrl = async (shortCode) => {
  const result = await pool.query(
    `
      UPDATE urls
      SET is_active = false
      WHERE short_code = $1 AND is_active = true
      RETURNING id
    `,
    [shortCode]
  );

  return result.rows.length > 0;
};
