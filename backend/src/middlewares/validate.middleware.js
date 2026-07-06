import { validateUrl } from "../utils/validateUrl.js";
import { AppError } from "../utils/AppError.js";

export const validateCreateUrl = (req, res, next) => {
  const { longUrl } = req.body;

  const result = validateUrl(longUrl);

  if (!result.valid) {
    return next(new AppError(result.message, 400));
  }

  req.body.longUrl = result.normalizedUrl;
  next();
};