import { PrismaClient } from "../../generated/prisma/index.js";

const prisma = new PrismaClient();

/**
 * Create a new URL entry in the database
 * @param {string} longUrl - The original long URL
 * @param {string} shortCode - The short code (generated or custom)
 * @param {boolean} customAlias - Whether this is a custom alias
 * @param {string|null} expiresAt - Optional expiration timestamp
 * @returns {Promise<Object>} - The created URL record
 */
export const createUrl = async (longUrl, shortCode, customAlias = false, expiresAt = null) => {
  return prisma.url.create({
    data: {
      long_url: longUrl,
      short_code: shortCode,
      custom_alias: customAlias,
      expires_at: expiresAt ? new Date(expiresAt) : null,
      is_active: true,
    },
  });
};

/**
 * Find a URL by its short code
 * @param {string} shortCode - The short code to look up
 * @returns {Promise<Object|null>} - The URL record or null if not found
 */
export const findByShortCode = async (shortCode) => {
  return prisma.url.findUnique({
    where: { short_code: shortCode },
  });
};

/**
 * Check if a short code already exists (for custom alias validation)
 * @param {string} shortCode - The short code to check
 * @returns {Promise<boolean>} - True if the short code exists
 */
export const shortCodeExists = async (shortCode) => {
  const url = await prisma.url.findUnique({
    where: { short_code: shortCode },
  });
  return !!url;
};

/**
 * Deactivate a URL (soft delete)
 * @param {string} shortCode - The short code to deactivate
 * @returns {Promise<boolean>} - True if the URL was deactivated
 */
export const updateUrl = async (shortCode, longUrl, updatedShortCode, customAlias, expiresAt) => {
  return prisma.url.update({
    where: { short_code: shortCode },
    data: {
      long_url: longUrl,
      short_code: updatedShortCode,
      custom_alias: customAlias,
      expires_at: expiresAt ? new Date(expiresAt) : null,
    },
  });
};

export const deactivateUrl = async (shortCode) => {
  const result = await prisma.url.updateMany({
    where: {
      short_code: shortCode,
      is_active: true,
    },
    data: {
      is_active: false,
    },
  });
  return result.count > 0;
};
