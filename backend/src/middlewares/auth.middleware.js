import jwt from "jsonwebtoken";
import { findUserById } from "../repositories/user.repository.js";
import { getJwtSecret } from "../utils/auth.utils.js";
import { AppError } from "../utils/AppError.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      throw new AppError("Authentication required", 401);
    }

    const decoded = jwt.verify(token, getJwtSecret());
    const user = await findUserById(decoded.userId);

    if (!user) {
      throw new AppError("User not found", 401);
    }

    if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      throw new AppError("Session expired. Please sign in again.", 401);
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }

    const error = new AppError(err.name === "TokenExpiredError" ? "Token expired" : "Invalid or expired token", 401);
    return next(error);
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden: You do not have permission to perform this action", 403));
    }
    next();
  };
};
