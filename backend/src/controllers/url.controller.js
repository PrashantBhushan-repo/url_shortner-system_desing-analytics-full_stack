import {
  shortenUrl,
  getOriginalUrl,
} from "../services/url.service.js";



// Create



export const createShortUrl =
  async (req, res, next) => {
    try {

      const { longUrl } =
        req.body;

      const result =
        await shortenUrl(
          longUrl
        );

      res.status(201).json(
        result
      );

    } catch (error) {
      next(error);
    }
  };



//   


// Redirect



export const redirectUrl =
  async (req, res, next) => {

    try {

      const { shortCode } =
        req.params;

      const longUrl =
        await getOriginalUrl(
          shortCode
        );

      res.redirect(longUrl);

    } catch (error) {
      next(error);
    }
  };