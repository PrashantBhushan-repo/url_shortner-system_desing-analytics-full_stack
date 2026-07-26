import { getSecuritySessions, revokeSession, revokeOtherSessions, revokeAllSessionsUser } from "../services/profile.service.js";
import { AppError } from "../utils/AppError.js";
import { hashToken } from "../utils/auth.utils.js";

export const listSessions = async (req, res, next) => {
  try {
    const currentRefreshToken = req.cookies?.refreshToken;
    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    const { refreshTokens } = await getSecuritySessions(req.user);
    // Filter active (non-revoked, non-expired) refresh tokens
    const active = refreshTokens
      .filter((t) => !t.revoked && new Date(t.expiresAt) > new Date())
      .map((t) => {
        const { tokenHash, ...safeToken } = t;
        return {
          ...safeToken,
          isCurrent: currentHash ? tokenHash === currentHash : false,
        };
      });

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

export const revokeAllSessions = async (req, res, next) => {
  try {
    await revokeAllSessionsUser(req.user);
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.status(200).json({
      success: true,
      message: "All sessions revoked successfully. You have been logged out.",
    });
  } catch (err) {
    next(err);
  }
};
