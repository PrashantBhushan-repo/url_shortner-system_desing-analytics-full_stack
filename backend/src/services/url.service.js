import {
  createUrl,
  findByShortCode,
  findByShortCodeForUser,
  shortCodeExists,
  updateUrl,
  deactivateUrl,
  listUrlsForUser,
  findById,
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
  isAlive: url.is_alive ?? true,
  lastCheckedAt: url.last_checked_at,
  healthCheckFailures: url.health_check_failures ?? 0,
  expiresAt: url.expires_at,
  createdAt: url.created_at,
  clicksCount: url.clicks_count !== undefined ? Number(url.clicks_count) : 0,
});

export const shortenUrl = async (longUrl, customAlias = null, expiresAt = null, user = null) => {
  if (customAlias) {
    const exists = await shortCodeExists(customAlias);
    if (exists) {
      throw new AppError("Custom alias already taken", 409);
    }

    const url = await createUrl(longUrl, customAlias, true, expiresAt, user?.id ?? null);
    return formatUrlResponse(url);
  }

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
    const shortCode = generateShortCode();

    try {
      const url = await createUrl(longUrl, shortCode, false, expiresAt, user?.id ?? null);
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
  if (cachedUrl && cachedUrl.longUrl) {
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

  const urlData = {
    id: url.id.toString(),
    longUrl: url.long_url,
  };

  await setCachedUrl(shortCode, urlData);

  return urlData;
};

export const getUrlStats = async (shortCode, user = null) => {
  const url = await findByShortCodeForUser(shortCode, user?.id ?? null, user?.role ?? "USER");

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  return formatUrlResponse(url);
};

export const getUrlHealthStatus = async (id) => {
  const url = await findById(id);

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  return {
    shortCode: url.short_code,
    isAlive: url.is_alive ?? true,
    lastCheckedAt: url.last_checked_at,
    healthCheckFailures: url.health_check_failures ?? 0,
  };
};

export const updateShortUrl = async (shortCode, updates, user = null) => {
  if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
    throw new AppError("Invalid update payload", 400);
  }

  const normalizedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(normalizedUpdates).length === 0) {
    throw new AppError("At least one field is required", 400);
  }

  const existingUrl = await findByShortCodeForUser(shortCode, user?.id ?? null, user?.role ?? "USER");

  if (!existingUrl) {
    throw new AppError("URL not found", 404);
  }

  if (existingUrl.is_active === false) {
    throw new AppError("This short URL is no longer active", 410);
  }

  let nextLongUrl = existingUrl.long_url;
  let nextShortCode = existingUrl.short_code;
  let nextCustomAlias = existingUrl.custom_alias;
  let nextExpiresAt = existingUrl.expires_at;

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "longUrl")) {
    nextLongUrl = normalizedUpdates.longUrl;
  }

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "customAlias")) {
    const alias = normalizedUpdates.customAlias?.trim();

    if (!alias) {
      throw new AppError("Custom alias must be at least 3 characters", 400);
    }

    if (alias !== existingUrl.short_code) {
      const exists = await shortCodeExists(alias);
      if (exists) {
        throw new AppError("Custom alias already taken", 409);
      }
    }

    nextShortCode = alias;
    nextCustomAlias = true;
  }

  if (Object.prototype.hasOwnProperty.call(normalizedUpdates, "expiresAt")) {
    nextExpiresAt = normalizedUpdates.expiresAt ?? null;
  }

  const updatedUrl = await updateUrl(shortCode, nextLongUrl, nextShortCode, nextCustomAlias, nextExpiresAt, user?.id ?? null, user?.role ?? "USER");

  if (!updatedUrl) {
    throw new AppError("URL not found or is no longer active", 404);
  }

  await invalidateCache(shortCode);

  return formatUrlResponse(updatedUrl);
};

export const deactivateShortUrl = async (shortCode, user = null) => {
  const deactivated = await deactivateUrl(shortCode, user?.id ?? null, user?.role ?? "USER");

  if (!deactivated) {
    throw new AppError("URL not found or already inactive", 404);
  }

  await invalidateCache(shortCode);

  return { success: true, message: "URL deactivated successfully" };
};

export const listUserUrls = async (user = null) => {
  const urls = await listUrlsForUser(user?.id ?? null, user?.role ?? "USER");
  return urls.map(formatUrlResponse);
};

export const getUrlById = async (id, user = null) => {
  const url = await findById(id);
  if (!url) {
    throw new AppError("URL not found", 404);
  }
  if (url.user_id !== user?.id && user?.role !== "ADMIN") {
    throw new AppError("Unauthorized access to this URL", 403);
  }
  return formatUrlResponse(url);
};
