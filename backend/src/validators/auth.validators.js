import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[@$!%*?&#^()_+\-=[\]{};':"\\|,.<>/?]/, "Password must contain at least one special character");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(50, "Full name must be at most 50 characters")
    .regex(/^[a-zA-Z '-]+$/, "Name may only contain letters, spaces, hyphens, and apostrophes"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(254, "Email must be at most 254 characters"),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().trim().length(6),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8).max(128),
});

export const verifyLoginOtpSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().trim().length(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  otp: z.string().trim().length(6),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newPassword: passwordSchema,
});

export const profileUpdateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be at most 50 characters")
    .regex(/^[a-zA-Z '-]+$/, "Name may only contain letters, spaces, hyphens, and apostrophes")
    .optional(),
  profileImage: z
    .union([
      z
        .string()
        .regex(/^data:image\/(jpeg|jpg|png|webp|gif);base64,/, "Invalid profile image format")
        .max(350000, "Profile image is too large"),
      z.literal(""),
      z.null(),
    ])
    .optional()
    .nullable(),
});

export const emailChangeRequestSchema = z.object({
  currentPassword: z.string().min(8).max(128),
  newEmail: z.string().trim().email("Invalid email address"),
});

export const emailChangeConfirmSchema = z.object({
  otp: z.string().trim().length(6),
  newEmail: z.string().trim().email("Invalid email address"),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const twoFactorOtpSchema = z.object({
  otp: z.string().trim().length(6, "Enter a valid 6-digit code"),
});
