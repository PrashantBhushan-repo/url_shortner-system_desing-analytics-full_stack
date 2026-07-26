import { z } from "zod";
import { AppError } from "../utils/AppError.js";

const createUrlSchema = z
  .object({
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
    password: z
      .string()
      .min(1, "Password must not be empty")
      .max(64, "Password too long")
      .optional(),
    customDomainId: z
      .string()
      .regex(/^\d+$/, "customDomainId must be a numeric string representable as BigInt")
      .optional(),
  })
  .strict();

const updateUrlSchema = z
  .object({
    longUrl: z
      .string()
      .trim()
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
      .transform((url) => new URL(url.trim()).href)
      .optional(),

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
      .nullable()
      .optional(),
    password: z
      .string()
      .min(1, "Password must not be empty")
      .max(64, "Password too long")
      .nullable()
      .optional(),
    customDomainId: z
      .string()
      .regex(/^\d+$/, "customDomainId must be a numeric string representable as BigInt")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const normalizePayload = (reqBody) => ({
  longUrl: reqBody?.longUrl ?? reqBody?.long_url,
  customAlias: reqBody?.customAlias ?? reqBody?.custom_alias,
  expiresAt: reqBody?.expiresAt ?? reqBody?.expires_at,
  password: reqBody?.password,
  customDomainId: reqBody?.customDomainId ?? reqBody?.custom_domain_id,
});

const sanitizeValidatedBody = (body) =>
  Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined));

export const validateCreateUrl = (req, res, next) => {
  const payload = normalizePayload(req.body);
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

export const validateUpdateUrl = (req, res, next) => {
  const payload = normalizePayload(req.body);
  const validationResult = updateUrlSchema.safeParse(payload);

  if (!validationResult.success) {
    const errors = validationResult.error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    return next(new AppError("Validation failed", 400, errors));
  }

  req.body = sanitizeValidatedBody(validationResult.data);
  next();
};