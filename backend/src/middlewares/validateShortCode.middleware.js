import { validateShortCode } from "../utils/validateShortCode.js";
import { AppError } from "../utils/AppError.js";

export const validateShortCodeParam = (req, res, next) => {
  const result = validateShortCode(req.params.shortCode);

  if (!result.valid) {
    return next(new AppError(result.message, 400));
  }

  next();
};
