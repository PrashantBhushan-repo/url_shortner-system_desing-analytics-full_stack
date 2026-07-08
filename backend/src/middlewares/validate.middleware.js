import { z } from "zod";
import { AppError } from "../utils/AppError.js";

const createUrlSchema = z.object({
  longUrl: z
    .string()
    .min(1, "URL is required")
    .max(2048, "URL is too long (max 2048 characters)")
    .refine((url) => {
      try {
        const parsed = new URL(url.trim());
        return ["http:", "https:"].includes(parsed.protocol);
      } catch {
        return false;
      }
    }, "Invalid URL format. Only http and https URLs are allowed")
    .refine((url) => {
      const lower = url.trim().toLowerCase();
      return !lower.startsWith("javascript:") && !lower.startsWith("data:");
    }, "URLs with javascript: or data: schemes are not allowed")
    .transform((url) => new URL(url.trim()).href),

  customAlias: z
    .string()
    .trim()
    .min(3, "Custom alias must be at least 3 characters")
    .max(10, "Custom alias must be at most 10 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Custom alias must be alphanumeric (letters and numbers only)")
    .optional(),

  expiresAt: z
    .string()
    .datetime({ message: "expiresAt must be a valid ISO timestamp" })
    .optional(),
});

export const validateCreateUrl = (req, res, next) => {
  const payload = {
    longUrl: req.body?.longUrl ?? req.body?.long_url,
    customAlias: req.body?.customAlias ?? req.body?.custom_alias,
    expiresAt: req.body?.expiresAt ?? req.body?.expires_at,
  };

  const validationResult = createUrlSchema.safeParse(payload);

  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    return next(new AppError("Validation failed", 400, errors));
  }

  req.body = validationResult.data;
  next();
};