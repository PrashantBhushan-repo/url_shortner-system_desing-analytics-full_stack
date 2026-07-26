import { getSecuritySessions, revokeSession, revokeOtherSessions } from "../services/profile.service.js";
import { AppError } from "../utils/AppError.js";

export const listSessions = async (req, res, next) => {
  try {
    const { refreshTokens } = await getSecuritySessions(req.user);
    // Filter active (non-revoked, non-expired) refresh tokens
    const active = refreshTokens.filter(
      (t) => !t.revoked && new Date(t.expiresAt) > new Date()
    );
    res.status(200).json({
      success: true,
      message: "Active sessions fetched",
      data: active,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    await revokeSession(id, req.user);
    res.status(200).json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const revokeAllOtherSessions = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!currentRefreshToken) {
      throw new AppError("Active session token required", 400);
    }
    await revokeOtherSessions(currentRefreshToken, req.user);
    res.status(200).json({
      success: true,
      message: "Other sessions revoked successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const getLoginHistory = async (req, res, next) => {
  try {
    const { loginEvents } = await getSecuritySessions(req.user);
    res.status(200).json({
      success: true,
      message: "Login history fetched",
      data: loginEvents,
    });
  } catch (err) {
    next(err);
  }
};
