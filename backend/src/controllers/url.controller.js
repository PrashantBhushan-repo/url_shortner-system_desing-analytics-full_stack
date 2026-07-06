import {
  shortenUrl,
  getOriginalUrl,
  getUrlStats,
} from "../services/url.service.js";

export const createShortUrl = async (req, res, next) => {
  try {
    const { longUrl } = req.body;
    const result = await shortenUrl(longUrl);

    res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const redirectUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const longUrl = await getOriginalUrl(shortCode);

    res.redirect(302, longUrl);
  } catch (error) {
    next(error);
  }
};

export const fetchUrlStats = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const stats = await getUrlStats(shortCode);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
