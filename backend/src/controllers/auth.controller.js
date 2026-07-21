import { changePasswordSchema, emailChangeConfirmSchema, emailChangeRequestSchema, forgotPasswordSchema, loginSchema, logoutSchema, profileUpdateSchema, refreshSchema, registerSchema, resetPasswordSchema, twoFactorOtpSchema, verifyEmailSchema, verifyLoginOtpSchema } from "../validators/auth.validators.js";
import { forgotPasswordUser, loginUser, logoutUser, refreshAccessToken, registerUser, resendOtp, resetPasswordUser, verifyEmailOtp, verifyLoginOtp as verifyLoginOtpService } from "../services/auth.service.js";
import { changePasswordUser, confirmEmailChange, getProfileUser, getSecuritySessions, requestEmailChange, updateProfileUser } from "../services/profile.service.js";
import { disableTwoFactor, enableTwoFactor, setupTwoFactor } from "../services/twoFactor.service.js";import { config } from "../config/config.js";
import { AppError } from "../utils/AppError.js";

export const register = async (req, res) => {
  const result = await registerUser(req.validated);
  res.status(201).json({ success: true, message: result.message, data: result });
};


export const verifyEmail = async (req, res) => {
  await verifyEmailOtp(req.validated);
  res.status(200).json({ success: true, message: "Email verified" });
};

export const resendOtpController = async (req, res) => {
  const result = await resendOtp(req.validated);
  res.status(200).json({ success: true, message: result.message, data: result });
};

export const login = async (req, res) => {
  const result = await loginUser(req.validated, req);
  res.status(200).json({ success: true, message: "Login verification code sent", data: result });
};

export const verifyLoginOtp = async (req, res) => {
  const result = await verifyLoginOtpService(req.validated, req);
  
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
    },
  });
};

export const forgotPassword = async (req, res) => {
  const result = await forgotPasswordUser(req.validated);
  res.status(200).json({ success: true, message: "If an account exists, a reset code has been sent", data: result });
};

export const resetPassword = async (req, res) => {
  await resetPasswordUser(req.validated);
  res.status(200).json({ success: true, message: "Password reset successful" });
};

export const changePassword = async (req, res) => {
  await changePasswordUser(req.validated, req.user);
  res.status(200).json({ success: true, message: "Password changed successfully" });
};

export const getProfile = async (req, res) => {
  const result = await getProfileUser(req.user);
  res.status(200).json({ success: true, message: "Profile fetched", data: result });
};

export const updateProfile = async (req, res) => {
  const result = await updateProfileUser(req.validated, req.user);
  res.status(200).json({ success: true, message: "Profile updated", data: result });
};

export const requestEmailChangeController = async (req, res) => {
  const result = await requestEmailChange(req.validated, req.user);
  res.status(200).json({ success: true, message: "Confirmation code sent", data: result });
};

export const confirmEmailChangeController = async (req, res) => {
  await confirmEmailChange(req.validated, req.user);
  res.status(200).json({ success: true, message: "Email updated successfully" });
};

export const getSecuritySessionsController = async (req, res) => {
  const result = await getSecuritySessions(req.user);
  res.status(200).json({ success: true, message: "Security sessions fetched", data: result });
};

export const refresh = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.validated?.refreshToken;
  if (!refreshToken) {
    throw new AppError("Refresh token required", 401);
  }
  
  const result = await refreshAccessToken({ refreshToken }, req);
  
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({
    success: true,
    message: "Token refreshed",
    data: {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
    },
  });
};

export const logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.validated?.refreshToken;
  if (refreshToken) {
    await logoutUser({ refreshToken });
  }
  
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
  });
  
  res.status(200).json({ success: true, message: "Logged out" });
};

export const setupTwoFactorController = async (req, res) => {
  const result = await setupTwoFactor(req.user);
  res.status(200).json({
    success: true,
    message: "Scan the QR code with your authenticator app",
    data: result,
  });
};

export const enableTwoFactorController = async (req, res) => {
  const result = await enableTwoFactor(req.user, req.validated.otp);
  res.status(200).json({
    success: true,
    message: "Two-factor authentication enabled",
    data: result,
  });
};

export const disableTwoFactorController = async (req, res) => {
  const result = await disableTwoFactor(req.user, req.validated.otp);
  res.status(200).json({
    success: true,
    message: "Two-factor authentication disabled",
    data: result,
  });
};
