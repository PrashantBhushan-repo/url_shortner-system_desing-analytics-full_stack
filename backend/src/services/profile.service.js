import bcrypt from "bcrypt";
import {
  findUserByEmail,
  findUserById,
  incrementTokenVersion,
  revokeRefreshTokensByUserId,
  updateUserPassword,
  updateUserProfile,
  revokeRefreshTokenByIdAndUser,
  revokeOtherRefreshTokens,
} from "../repositories/user.repository.js";
import { getRedisClient } from "../config/redisClient.js";
import { sendEmail } from "../utils/mailer.js";
import prisma from "../config/prismaClient.js";
import { SALT_ROUNDS, generateOtp, hashOtp, toAuthError, hashToken } from "../utils/auth.utils.js";

const OTP_MAX_ATTEMPTS = 5;

export const changePasswordUser = async ({ currentPassword, newPassword }, user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) throw toAuthError("User not found", 404);

  const passwordValid = await bcrypt.compare(currentPassword, existingUser.passwordHash);
  if (!passwordValid) throw toAuthError("Current password is incorrect", 401);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updateUserPassword(existingUser.id, passwordHash);
  await incrementTokenVersion(existingUser.id);
  await revokeRefreshTokensByUserId(existingUser.id);

  return true;
};

export const getProfileUser = async (user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) throw toAuthError("User not found", 404);

  const { passwordHash, twoFactorSecret, ...safeUser } = existingUser;
  return safeUser;
};

export const updateProfileUser = async (payload, user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) throw toAuthError("User not found", 404);

  const updateData = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
  }

  if (payload.profileImage !== undefined) {
    updateData.profileImage = payload.profileImage || null;
  }

  const updatedUser = await updateUserProfile(user.id, updateData);
  const { passwordHash, twoFactorSecret, ...safeUser } = updatedUser;
  return safeUser;
};

export const requestEmailChange = async ({ currentPassword, newEmail }, user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) throw toAuthError("User not found", 404);

  const passwordValid = await bcrypt.compare(currentPassword, existingUser.passwordHash);
  if (!passwordValid) throw toAuthError("Current password is incorrect", 401);

  const normalizedEmail = newEmail.toLowerCase();
  if (normalizedEmail === user.email.toLowerCase()) {
    throw toAuthError("New email must be different from the current email", 400);
  }

  const emailInUse = await findUserByEmail(normalizedEmail);
  if (emailInUse) throw toAuthError("Email already registered", 409);

  const otp = generateOtp();
  const client = getRedisClient();
  const key = `email_change:${user.id}`;
  const attemptsKey = `otp_attempts:email_change:${user.id}`;

  await client.set(key, JSON.stringify({ otpHash: hashOtp(otp), newEmail: normalizedEmail }), "EX", 60 * 10);
  await client.del(attemptsKey);

  await sendEmail({
    to: normalizedEmail,
    subject: "Confirm your email change",
    text: `Your email change confirmation code is ${otp}. It expires in 10 minutes.`,
  });

  return { message: "Confirmation code sent to your new email address" };
};

export const confirmEmailChange = async ({ otp, newEmail }, user) => {
  const client = getRedisClient();
  const key = `email_change:${user.id}`;
  const attemptsKey = `otp_attempts:email_change:${user.id}`;
  const attempts = Number(await client.get(attemptsKey)) || 0;

  if (attempts >= OTP_MAX_ATTEMPTS) {
    throw toAuthError("Too many invalid attempts. Request a new code.", 429);
  }

  const storedValue = await client.get(key);
  if (!storedValue) {
    throw toAuthError("Verification code not found or expired", 400);
  }

  const parsed = JSON.parse(storedValue);
  const normalizedEmail = newEmail.toLowerCase();

  if (parsed.newEmail !== normalizedEmail || parsed.otpHash !== hashOtp(otp)) {
    await client.incr(attemptsKey);
    await client.expire(attemptsKey, 60 * 15);
    throw toAuthError("Invalid verification code", 400);
  }

  await updateUserProfile(user.id, { email: parsed.newEmail, emailVerified: false });
  await incrementTokenVersion(user.id);
  await revokeRefreshTokensByUserId(user.id);
  await client.del(key);
  await client.del(attemptsKey);

  return true;
};

export const getSecuritySessions = async (user) => {
  const refreshTokens = await prisma.refreshToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      device: true,
      ip: true,
      createdAt: true,
      expiresAt: true,
      revoked: true,
    },
  });

  const loginEvents = await prisma.loginEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      success: true,
      ip: true,
      device: true,
      createdAt: true,
    },
  });

  return { refreshTokens, loginEvents };
};

export const revokeSession = async (id, user) => {
  const success = await revokeRefreshTokenByIdAndUser(id, user.id);
  if (!success) {
    throw toAuthError("Session not found or already revoked", 404);
  }
  return true;
};

export const revokeOtherSessions = async (currentRefreshToken, user) => {
  const currentTokenHash = hashToken(currentRefreshToken);
  await revokeOtherRefreshTokens(user.id, currentTokenHash);
  return true;
};
