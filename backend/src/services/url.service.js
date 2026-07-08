import {
  createUrl,
  findByShortCode,
  shortCodeExists,
  deactivateUrl,
} from "../repositories/url.repository.js";

import { generateShortCode } from "../utils/generateShortCode.js";
import { AppError } from "../utils/AppError.js";
import { getCachedUrl, setCachedUrl, invalidateCache } from "./cache.service.js";
import { config } from "../config/config.js";

const MAX_COLLISION_RETRIES = 5;

const formatUrlResponse = (url) => ({
  id: url.id,
  longUrl: url.long_url,
  shortCode: url.short_code,
  shortUrl: `${config.baseUrl}/${url.short_code}`,
  customAlias: url.custom_alias,
  isActive: url.is_active,
  expiresAt: url.expires_at,
  createdAt: url.created_at,
});

export const shortenUrl = async (longUrl, customAlias = null, expiresAt = null) => {
  if (customAlias) {
    const exists = await shortCodeExists(customAlias);
    if (exists) {
      throw new AppError("Custom alias already taken", 409);
    }

    const url = await createUrl(longUrl, customAlias, true, expiresAt);
    return formatUrlResponse(url);
  }

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const shortCode = generateShortCode();

    try {
      const url = await createUrl(longUrl, shortCode, false, expiresAt);
      return formatUrlResponse(url);
    } catch (error) {
      if (error?.code === "23505") {
        continue;
      }
      throw error;
    }
  }

  throw new AppError("Unable to generate a unique short code. Please try again.", 500);
};

export const getOriginalUrl = async (shortCode) => {
  const cachedUrl = await getCachedUrl(shortCode);
  if (cachedUrl) {
    return cachedUrl;
  }

  const url = await findByShortCode(shortCode);

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (url.is_active === false) {
    throw new AppError("This short URL is no longer active", 410);
  }

  if (url.expires_at && new Date(url.expires_at) < new Date()) {
    throw new AppError("This short URL has expired", 410);
  }

  await setCachedUrl(shortCode, url.long_url);

  return url.long_url;
};

export const getUrlStats = async (shortCode) => {
  const url = await findByShortCode(shortCode);

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  return formatUrlResponse(url);
};

export const deactivateShortUrl = async (shortCode) => {
  const deactivated = await deactivateUrl(shortCode);

  if (!deactivated) {
    throw new AppError("URL not found or already inactive", 404);
  }

  await invalidateCache(shortCode);

  return { success: true, message: "URL deactivated successfully" };
};
