import express from "express";
import { changePassword, confirmEmailChangeController, disableTwoFactorController, enableTwoFactorController, forgotPassword, getProfile, getSecuritySessionsController, login, logout, refresh, register, requestEmailChangeController, resendOtpController, resetPassword, setupTwoFactorController, updateProfile, verifyEmail, verifyLoginOtp as verifyLoginOtpController } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { authGeneralLimiter, authLoginLimiter, authOtpLimiter, authSensitiveLimiter } from "../middlewares/rateLimit.middleware.js";
import { validateBody } from "../middlewares/validateAuth.middleware.js";
import { z } from "zod";
import { changePasswordSchema, emailChangeConfirmSchema, emailChangeRequestSchema, forgotPasswordSchema, loginSchema, logoutSchema, profileUpdateSchema, refreshSchema, registerSchema, resetPasswordSchema, twoFactorOtpSchema, verifyEmailSchema, verifyLoginOtpSchema } from "../validators/auth.validators.js";

const router = express.Router();

router.post("/register", authSensitiveLimiter, validateBody(registerSchema), register);
router.post("/verify-email", authOtpLimiter, validateBody(verifyEmailSchema), verifyEmail);
router.post("/resend-otp", authOtpLimiter, validateBody(z.object({ purpose: z.enum(["email_verify", "login_otp"]), userId: z.string().uuid() })), resendOtpController);
router.post("/login", authLoginLimiter, validateBody(loginSchema), login);
router.post("/verify-login-otp", authOtpLimiter, validateBody(verifyLoginOtpSchema), verifyLoginOtpController);
router.post("/forgot-password", authLoginLimiter, validateBody(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", authOtpLimiter, validateBody(resetPasswordSchema), resetPassword);
router.post("/refresh", authGeneralLimiter, validateBody(refreshSchema), refresh);
router.post("/logout", authGeneralLimiter, validateBody(logoutSchema), logout);

router.post("/change-password", authGeneralLimiter, authMiddleware, validateBody(changePasswordSchema), changePassword);
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authGeneralLimiter, authMiddleware, validateBody(profileUpdateSchema), updateProfile);
router.post("/change-email/request", authGeneralLimiter, authMiddleware, validateBody(emailChangeRequestSchema), requestEmailChangeController);
router.post("/change-email/confirm", authOtpLimiter, authMiddleware, validateBody(emailChangeConfirmSchema), confirmEmailChangeController);
router.get("/security-sessions", authMiddleware, getSecuritySessionsController);
router.post("/2fa/setup", authSensitiveLimiter, authMiddleware, setupTwoFactorController);
router.post("/2fa/enable", authSensitiveLimiter, authMiddleware, validateBody(twoFactorOtpSchema), enableTwoFactorController);
router.post("/2fa/disable", authSensitiveLimiter, authMiddleware, validateBody(twoFactorOtpSchema), disableTwoFactorController);

export default router;
