import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../config/prismaClient.js";
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
import jwt from "jsonwebtoken";
import {
  SALT_ROUNDS,
  createAccessToken,
  generateOtp,
  getRequestMeta,
  hashOtp,
  hashToken,
  toAuthError,
  parseRequestMeta,
  getJwtSecret,
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

const createRefreshTokenRecord = async ({ userId, token, device, ip, browser, os, location }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  });
  const role = user?.role || "USER";

  // admins always re-verify OTP, no device-trust bypass — this is intentional, not an oversight
  const ttlMs = role === "ADMIN"
    ? 8 * 60 * 60 * 1000 // 8 hours for admins
    : config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000;

  const expiresAt = new Date(Date.now() + ttlMs);
  return createRefreshToken({
    userId,
    tokenHash: hashToken(token),
    device: device || null,
    ip: ip || null,
    browser: browser || null,
    os: os || null,
    location: location || null,
    expiresAt,
  });
};

const issueTokenPair = async (user, req = {}) => {
  const refreshTokenValue = crypto.randomBytes(32).toString("hex");
  const meta = await parseRequestMeta(req);

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

const recordLoginAttempt = async (userId, req, success, reason = null, riskLevel = null) => {
  try {
    const meta = await parseRequestMeta(req);
    await createLoginEvent({
      userId,
      ip: meta.ip,
      device: meta.device,
      success,
      location: meta.location,
      reason,
      riskLevel,
    });
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

  if (!user) {
    await recordLoginAttempt(null, req, false, "Email not registered", "high");
    throw toAuthError("Invalid credentials", 401);
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    await recordLoginAttempt(user.id, req, false, "Invalid password entered", "medium");
    throw toAuthError("Invalid credentials", 401);
  }

  if (!user.emailVerified) {
    await recordLoginAttempt(user.id, req, false, "Unverified email login blocked", "low");

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
    await recordLoginAttempt(user.id, req, true, "Password verified, 2FA required", "low");
    return { twoFactorRequired: true, userId: user.id };
  }

  try {
    await issueOtp({ purpose: "login_otp", userId: user.id, email: user.email });
  } catch (err) {
    console.warn("Failed to issue login otp:", err.message);
    throw err;
  }

  await recordLoginAttempt(user.id, req, true, "Password verified, OTP required", "low");

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

const verifyBackupCode = async (user, code) => {
  if (!user.twoFactorBackupCodes) {
    throw toAuthError("Invalid authenticator code or backup code", 400);
  }

  const backupCodes = JSON.parse(user.twoFactorBackupCodes);
  const normalizedCode = code.trim().toLowerCase().replace(/\s/g, "").replace(/-/g, "");

  let matchedIndex = -1;
  for (let i = 0; i < backupCodes.length; i++) {
    const codeHash = crypto.createHash("sha256").update(normalizedCode).digest("hex");
    if (backupCodes[i] === codeHash) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    throw toAuthError("Invalid authenticator code or backup code", 400);
  }

  // Remove the matched code
  backupCodes.splice(matchedIndex, 1);
  await updateUserProfile(user.id, {
    twoFactorBackupCodes: JSON.stringify(backupCodes),
  });

  return true;
};

const checkAndNotifyNewDeviceLogin = async (user, meta) => {
  // admins always receive new-device login email alerts, non-skippable — this is intentional, not an oversight
  if (!user.securityEmailAlerts && user.role !== "ADMIN") return;

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const existingLogins = await prisma.loginEvent.findMany({
      where: {
        userId: user.id,
        success: true,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        device: true,
        ip: true,
      },
      take: 20,
    });

    const isNew = !existingLogins.some(
      (login) => login.device === meta.device || (login.ip === meta.ip && login.device === meta.device)
    );

    if (isNew || user.role === "ADMIN") {
      const isAdmin = user.role === "ADMIN";
      await sendEmail({
        to: user.email,
        subject: isAdmin 
          ? "🔒 SECURITY CRITICAL: Administrative Console Login Alert"
          : "🔒 Security Alert: New Device Sign-in",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; background-color: ${isAdmin ? "#fef2f2" : "#f8fafc"}; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid ${isAdmin ? "#fca5a5" : "#e2e8f0"};">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px;">🛡️</span>
              <h2 style="color: ${isAdmin ? "#991b1b" : "#0f172a"}; margin-top: 12px; font-weight: 800; tracking-tight: -0.025em;">
                ${isAdmin ? "ADMINISTRATIVE LOGIN ALERT" : "New Login Detected"}
              </h2>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">Hello <strong>${user.name}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #334155;">
              ${isAdmin 
                ? "A successful administrative login was established for your account. Due to the high privilege level, this notification is mandatory."
                : "We detected a new successful sign-in to your SnapURL account from a device or location we don't recognize."}
            </p>
            
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b; font-size: 14px; width: 100px;">Browser/OS</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${meta.browser} on ${meta.os}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b; font-size: 14px;">Location</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${meta.location}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b; font-size: 14px;">IP Address</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px; font-family: monospace;">${meta.ip}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #64748b; font-size: 14px;">Timestamp</td>
                  <td style="padding: 6px 0; color: #0f172a; font-size: 14px;">${new Date().toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">If this was you, you can safely ignore this email.</p>
            <p style="font-size: 14px; line-height: 1.6; color: #b91c1c; font-weight: bold;">If you did not authorize this login, please change your password immediately and revoke all other sessions in your account settings.</p>
            
            <div style="border-top: 1px solid #e2e8f0; margin-top: 32px; padding-top: 16px; text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0;">SnapURL Security Operations Center</p>
            </div>
          </div>
        `,
      });
    }
  } catch (err) {
    console.warn("Failed to check and notify new device login:", err.message);
  }
};

export const verifyLoginOtp = async ({ userId, otp }, req = {}) => {
  const user = await findUserById(userId);
  if (!user || !user.emailVerified) {
    await recordLoginAttempt(userId, req, false, "Invalid login credentials", "high");
    throw toAuthError("Invalid credentials", 401);
  }

  const meta = await parseRequestMeta(req);

  try {
    if (user.twoFactorEnabled) {
      const isBackupCode = otp.includes("-") || otp.trim().length !== 6;
      if (isBackupCode) {
        await verifyBackupCode(user, otp);
      } else {
        await verifyTwoFactorLogin(userId, otp);
      }
    } else {
      await verifyOtp("login_otp", userId, otp);
    }
  } catch (err) {
    await recordLoginAttempt(user.id, req, false, err.message || "OTP/MFA verification failed", "medium");
    throw err;
  }

  await recordLoginAttempt(user.id, req, true, "Successful MFA verification", "low");
  await checkAndNotifyNewDeviceLogin(user, meta);

  if (user.must_change_password) {
    const changePasswordToken = jwt.sign(
      { userId: user.id, scope: "change_password" },
      getJwtSecret(),
      { expiresIn: "10m" }
    );
    return {
      mustChangePassword: true,
      changePasswordToken,
    };
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

export const forceChangePasswordService = async ({ changePasswordToken, newPassword }, req = {}) => {
  let decoded;
  try {
    decoded = jwt.verify(changePasswordToken, getJwtSecret());
  } catch (err) {
    throw new AppError("Invalid or expired password reset token.", 401);
  }

  if (decoded.scope !== "change_password") {
    throw new AppError("Invalid token scope", 401);
  }

  const user = await findUserById(decoded.userId);
  if (!user) {
    throw new AppError("User not found", 404);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      must_change_password: false,
    },
  });

  await recordLoginAttempt(user.id, req, true, "Password rotated on first sign-in complete", "low");

  return issueTokenPair(user, req);
};
