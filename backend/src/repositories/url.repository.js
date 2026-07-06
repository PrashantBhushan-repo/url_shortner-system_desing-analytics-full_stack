import pool from "../config/db.js";

export const createUrl = async (id, longUrl, shortCode) => {
  const query = `
    INSERT INTO urls (id, long_url, short_code)
    VALUES ($1, $2, $3)
    RETURNING *
  `;

  const result = await pool.query(query, [id, longUrl, shortCode]);
  return result.rows[0];
};

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

export const incrementClicks = async (shortCode) => {
  await pool.query(
    `
      UPDATE urls
      SET clicks = clicks + 1
      WHERE short_code = $1
    `,
    [shortCode]
  );
};
