import {
  shortenUrl,
  getOriginalUrl,
  getUrlStats,
  deactivateShortUrl,
  updateShortUrl as updateShortUrlService,
  listUserUrls,
} from "../services/url.service.js";
export const createShortUrl = async (req, res, next) => {
  try {
    const { longUrl, customAlias, expiresAt } = req.body;
    const result = await shortenUrl(longUrl, customAlias, expiresAt, req.user);

    res.status(201).json({
      success: true,
      data: result,
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
    const stats = await getUrlStats(shortCode, req.user);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const updateShortUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const result = await updateShortUrlService(shortCode, req.body, req.user);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteShortUrl = async (req, res, next) => {
  try {
    const { shortCode } = req.params;
    const result = await deactivateShortUrl(shortCode, req.user);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const fetchUserUrls = async (req, res, next) => {
  try {
    const urls = await listUserUrls(req.user);

    res.status(200).json({
      success: true,
      data: urls,
    });
  } catch (error) {
    next(error);
  }
};
