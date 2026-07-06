import { randomUUID } from "crypto";

import {
  createUrl,
  findByShortCode,
  incrementClicks,
} from "../repositories/url.repository.js";

import { generateShortCode } from "../utils/generateShortCode.js";
import { AppError } from "../utils/AppError.js";

const MAX_COLLISION_RETRIES = 5;

const formatUrlResponse = (url) => ({
  id: url.id,
  longUrl: url.long_url,
  shortCode: url.short_code,
  shortUrl: `${process.env.BASE_URL}/${url.short_code}`,
  clicks: url.clicks,
  isActive: url.is_active,
  createdAt: url.created_at,
});

export const shortenUrl = async (longUrl) => {
  const id = randomUUID();

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const shortCode = generateShortCode();

    try {
      const url = await createUrl(id, longUrl, shortCode);
      return formatUrlResponse(url);
    } catch (error) {
      if (error.code === "23505") {
        continue;
      }
      throw error;
    }
  }

  throw new AppError(
    "Unable to generate unique short code. Please try again.",
    500
  );
};

export const getOriginalUrl = async (shortCode) => {
  const url = await findByShortCode(shortCode);

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  if (url.is_active === false) {
    throw new AppError("This short URL is no longer active", 410);
  }

  await incrementClicks(shortCode);

  return url.long_url;
};

export const getUrlStats = async (shortCode) => {
  const url = await findByShortCode(shortCode);

  if (!url) {
    throw new AppError("URL not found", 404);
  }

  return formatUrlResponse(url);
};
