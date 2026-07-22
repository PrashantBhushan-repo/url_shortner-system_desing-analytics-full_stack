import bcrypt from "bcrypt";
import crypto from "crypto";
import {
  createLoginEvent,
  createRefreshToken,
  createUser,
  findActiveRefreshTokenByHash,
  findRefreshTokenByHash,
  findUserByEmail,
  findUserById,
  incrementTokenVersion,
  markEmailVerified,
  revokeRefreshToken,
  revokeRefreshTokenByHash,
  revokeRefreshTokensByUserId,
  updateUserPassword,
  updateUserProfile,
} from "../repositories/user.repository.js";
import { getRedisClient } from "../config/redisClient.js";
import { sendEmail } from "../utils/mailer.js";
import { config } from "../config/config.js";
import { AppError } from "../utils/AppError.js";
import {
  SALT_ROUNDS,
  createAccessToken,
  generateOtp,
  getRequestMeta,
  hashOtp,
  hashToken,
  toAuthError,
} from "../utils/auth.utils.js";
import { verifyTwoFactorLogin } from "./twoFactor.service.js";

const OTP_MAX_ATTEMPTS = 5;
const OTP_TTL_SECONDS = 60 * 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_RESEND_MAX_PER_WINDOW = 3;
const OTP_RESEND_WINDOW_SECONDS = 60 * 15;

const otpKey = (purpose, userId) => `${purpose}:${userId}`;
const otpAttemptsKey = (purpose, userId) => `otp_attempts:${purpose}:${userId}`;
const otpResendKey = (purpose, userId) => `otp_resend:${purpose}:${userId}`;
const otpResendCountKey = (purpose, userId) => `otp_resend_count:${purpose}:${userId}`;

const withAuthErrorHandling = async (operation, fallbackMessage) => {
  try {
    return await operation();
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (err?.code && err.code.startsWith("23")) {
      throw new AppError("Database error occurred", 503);
    }

    throw new AppError(fallbackMessage, 503);
  }
};

const getRedis = () => getRedisClient();

const storeOtp = async (purpose, userId, otp, ttlSeconds) => {
  const client = getRedis();
  await client.set(otpKey(purpose, userId), hashOtp(otp), "EX", ttlSeconds);
  await client.del(otpAttemptsKey(purpose, userId));
};

const canResendOtp = async (purpose, userId) => {
  const client = getRedis();
  const cooldownKey = otpResendKey(purpose, userId);
  const countKey = otpResendCountKey(purpose, userId);

  const cooldown = await client.get(cooldownKey);
  if (cooldown) {
    throw new AppError("Please wait before requesting a new code.", 429);
  }

  const count = Number(await client.get(countKey) || 0);
  if (count >= OTP_RESEND_MAX_PER_WINDOW) {
    throw new AppError("Too many OTP requests. Please try again later.", 429);
  }

  return { client, cooldownKey, countKey };
};

const markOtpResent = async (purpose, userId) => {
  const { client, cooldownKey, countKey } = await canResendOtp(purpose, userId);
  await client.set(cooldownKey, "1", "EX", OTP_RESEND_COOLDOWN_SECONDS);
  await client.incr(countKey);
  await client.expire(countKey, OTP_RESEND_WINDOW_SECONDS);
};

const verifyOtp = async (purpose, userId, otp) => {
  const client = getRedis();
  const attemptsKey = otpAttemptsKey(purpose, userId);
  const attempts = Number(await client.get(attemptsKey)) || 0;

  if (attempts >= OTP_MAX_ATTEMPTS) {
    throw toAuthError("Too many invalid attempts. Request a new code.", 429);
  }

  const storedHash = await client.get(otpKey(purpose, userId));
  if (!storedHash) {
    throw toAuthError("Code not found or expired", 400);
  }

  const isValid = storedHash === hashOtp(otp);
  if (!isValid) {
    await client.incr(attemptsKey);
    await client.expire(attemptsKey, 60 * 15);
    throw toAuthError("Invalid code", 400);
  }

  await client.del(otpKey(purpose, userId));
  await client.del(attemptsKey);
  return true;
};

const createRefreshTokenRecord = async ({ userId, token, device, ip }) => {
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000);
  return createRefreshToken({
    userId,
    tokenHash: hashToken(token),
    device: device || null,
    ip: ip || null,
    expiresAt,
  });
};

const issueTokenPair = async (user, req = {}) => {
  const refreshTokenValue = crypto.randomBytes(32).toString("hex");
  const meta = getRequestMeta(req);

  await withAuthErrorHandling(
    () =>
      createRefreshTokenRecord({
        userId: user.id,
        token: refreshTokenValue,
        ...meta,
      }),
    "We couldn't complete sign-in right now. Please try again later.",
  );

  return {
    accessToken: createAccessToken(user),
    refreshToken: refreshTokenValue,
    tokenType: "Bearer",
  };
};

const recordLoginAttempt = async (userId, req, success) => {
  const meta = getRequestMeta(req);
  try {
    await createLoginEvent({ userId, ...meta, success });
  } catch (err) {
    console.warn("Failed to record login event:", err.message);
  }
};

const sendOtpEmail = async ({ userId, email, purpose, otp }) => {
  const subject = purpose === "login_otp"
    ? "Your login verification code"
    : "Verify your email";
  const text = purpose === "login_otp"
    ? `Your login verification code is ${otp}. It expires in 10 minutes.`
    : `Your verification code is ${otp}. It expires in 10 minutes.`;

  await sendEmail({
    to: email,
    subject,
    text,
  });
};

const issueOtp = async ({ purpose, userId, email }) => {
  const otp = generateOtp();
  
  // Log OTP to terminal console so developer can read it instantly without checking email inbox
  console.log(`🔑 [OTP Code] Purpose: ${purpose}, Email: ${email}, Code: ${otp}`);

  await withAuthErrorHandling(
    async () => {
      await storeOtp(purpose, userId, otp, OTP_TTL_SECONDS);
      await markOtpResent(purpose, userId);
      try {
        await sendOtpEmail({ userId, email, purpose, otp });
      } catch (err) {
        console.error(`❌ Email dispatch failed for ${email}:`, err.message);
        if (config.nodeEnv !== "production") {
          console.log("⚠️ Development mode: bypassing email dispatch failure so you can verify with the code logged above.");
        } else {
          throw err;
        }
      }
    },
    purpose === "login_otp"
      ? "We couldn't send the sign-in code right now. Please try again later."
      : "Unable to send verification email. Please try again later.",
  );

  return otp;
};

export const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.toLowerCase();
  const existing = await withAuthErrorHandling(
    () => findUserByEmail(normalizedEmail),
    "We couldn't check your account right now. Please try again later.",
  );

  if (existing) {
    if (existing.emailVerified) {
      throw toAuthError("Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await withAuthErrorHandling(
      () => updateUserProfile(existing.id, { name, passwordHash }),
      "We couldn't update your account right now. Please try again later.",
    );

    try {
      await issueOtp({ purpose: "email_verify", userId: existing.id, email: existing.email });
    } catch (err) {
      console.warn("Failed to complete registration email flow:", err.message);
      throw err;
    }

    return { userId: existing.id, message: "Verification code sent to your email" };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await withAuthErrorHandling(
    () =>
      createUser({
        name,
        email: normalizedEmail,
        passwordHash,
      }),
    "We couldn't create your account right now. Please try again later.",
  );

  try {
    await issueOtp({ purpose: "email_verify", userId: user.id, email: user.email });
  } catch (err) {
    console.warn("Failed to complete registration email flow:", err.message);
    throw err;
  }

  return { userId: user.id, message: "Verification code sent to your email" };
};

export const verifyEmailOtp = async ({ userId, otp }) => {
  await verifyOtp("email_verify", userId, otp);
  await markEmailVerified(userId);
  return true;
};

export const loginUser = async ({ email, password }, req = {}) => {
  const normalizedEmail = email.toLowerCase();
  const user = await withAuthErrorHandling(
    () => findUserByEmail(normalizedEmail),
    "We couldn't check your account right now. Please try again later.",
  );
  const meta = getRequestMeta(req);

  if (!user) {
    await recordLoginAttempt(null, req, false);
    throw toAuthError("Invalid credentials", 401);
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    await recordLoginAttempt(user.id, req, false);
    throw toAuthError("Invalid credentials", 401);
  }

  if (!user.emailVerified) {
    await recordLoginAttempt(user.id, req, false);

    // Auto re-send OTP if they try to log in but are unverified, for convenience
    try {
      await issueOtp({ purpose: "email_verify", userId: user.id, email: user.email });
    } catch (err) {
      console.warn("Failed to resend verification email on login attempt:", err.message);
      throw err;
    }

    throw new AppError("Email not verified. A new verification code has been sent.", 403, { userId: user.id }, "EMAIL_NOT_VERIFIED");
  }

  if (user.twoFactorEnabled) {
    await recordLoginAttempt(user.id, req, true);
    return { twoFactorRequired: true, userId: user.id };
  }

  try {
    await issueOtp({ purpose: "login_otp", userId: user.id, email: user.email });
  } catch (err) {
    console.warn("Failed to issue login otp:", err.message);
    throw err;
  }

  await recordLoginAttempt(user.id, req, true);

  return { otpRequired: true, userId: user.id };
};

export const resendOtp = async ({ purpose, userId }) => {
  const user = await findUserById(userId);
  if (!user) {
    throw toAuthError("Invalid user", 404);
  }

  if (!user.emailVerified && purpose === "email_verify") {
    await issueOtp({ purpose, userId: user.id, email: user.email });
    return { userId: user.id, message: "A new verification code has been sent" };
  }

  if (purpose === "login_otp") {
    await issueOtp({ purpose, userId: user.id, email: user.email });
    return { userId: user.id, message: "A new login code has been sent" };
  }

  throw toAuthError("Unsupported OTP purpose", 400);
};

export const forgotPasswordUser = async ({ email }) => {
  const normalizedEmail = email.toLowerCase();
  const user = await findUserByEmail(normalizedEmail);

  if (user) {
    const otp = generateOtp();
    await storeOtp("password_reset", user.id, otp, 60 * 10);

    try {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Your password reset code is ${otp}. It expires in 10 minutes.`,
      });
    } catch (err) {
      console.warn("Failed to send password reset email:", err.message);
    }

    return { userId: user.id, message: "If an account exists, a reset code has been sent" };
  }

  return { message: "If an account exists, a reset code has been sent" };
};

export const resetPasswordUser = async ({ userId, otp, password }) => {
  await verifyOtp("password_reset", userId, otp);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await updateUserPassword(userId, passwordHash);
  await incrementTokenVersion(userId);
  await revokeRefreshTokensByUserId(userId);

  return true;
};

export const verifyLoginOtp = async ({ userId, otp }, req = {}) => {
  const user = await findUserById(userId);
  if (!user || !user.emailVerified) {
    throw toAuthError("Invalid credentials", 401);
  }

  if (user.twoFactorEnabled) {
    await verifyTwoFactorLogin(userId, otp);
  } else {
    await verifyOtp("login_otp", userId, otp);
  }

  return issueTokenPair(user, req);
};

export const refreshAccessToken = async ({ refreshToken }, req = {}) => {
  const tokenHash = hashToken(refreshToken);
  const stored = await findRefreshTokenByHash(tokenHash);

  if (!stored) {
    throw toAuthError("Refresh token invalid or revoked", 401);
  }

  if (stored.revoked) {
    await revokeRefreshTokensByUserId(stored.userId);
    await incrementTokenVersion(stored.userId);
    throw toAuthError("Session compromise detected. Please log in again.", 401);
  }

  if (new Date(stored.expiresAt) < new Date()) {
    throw toAuthError("Refresh token expired", 401);
  }

  const user = await findUserById(stored.userId);
  if (!user) {
    throw toAuthError("User not found", 401);
  }

  await revokeRefreshToken(stored.id);

  const newRefreshTokenValue = crypto.randomBytes(32).toString("hex");
  const meta = getRequestMeta(req);

  await createRefreshTokenRecord({
    userId: stored.userId,
    token: newRefreshTokenValue,
    ...meta,
  });

  return {
    accessToken: createAccessToken(user),
    refreshToken: newRefreshTokenValue,
    tokenType: "Bearer",
  };
};

export const logoutUser = async ({ refreshToken }) => {
  const tokenHash = hashToken(refreshToken);
  await revokeRefreshTokenByHash(tokenHash);
  return true;
};
