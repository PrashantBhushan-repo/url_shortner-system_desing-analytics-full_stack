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

  // Send password change notification email
  if (existingUser.securityEmailAlerts) {
    try {
      await sendEmail({
        to: existingUser.email,
        subject: "🔒 Security Alert: Password Changed",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
            <div style="text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px;">🔑</span>
              <h2 style="color: #0f172a; margin-top: 12px; font-weight: 800;">Password Changed</h2>
            </div>
            <p>Hello <strong>${existingUser.name}</strong>,</p>
            <p>The password for your SnapURL account was recently changed.</p>
            <p style="background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 14px;">Timestamp: ${new Date().toLocaleString()}</p>
            <p style="color: #b91c1c; font-weight: bold; margin-top: 20px;">If you did not authorize this change, please contact support or perform a password reset immediately to secure your account.</p>
          </div>
        `,
      });
    } catch (err) {
      console.warn("Failed to send password change email:", err.message);
    }
  }

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

  if (payload.securityEmailAlerts !== undefined) {
    updateData.securityEmailAlerts = payload.securityEmailAlerts;
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

  const existingUser = await findUserById(user.id);
  const oldEmail = existingUser.email;

  await updateUserProfile(user.id, { email: parsed.newEmail, emailVerified: false });
  await incrementTokenVersion(user.id);
  await revokeRefreshTokensByUserId(user.id);
  await client.del(key);
  await client.del(attemptsKey);

  // Send notifications to BOTH old and new email addresses
  if (existingUser.securityEmailAlerts) {
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 24px; color: #0f172a; background-color: #f8fafc; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px;">✉️</span>
            <h2 style="color: #0f172a; margin-top: 12px; font-weight: 800;">Email Changed</h2>
          </div>
          <p>Hello <strong>${existingUser.name}</strong>,</p>
          <p>The email address associated with your SnapURL account has been successfully changed from <strong>${oldEmail}</strong> to <strong>${parsed.newEmail}</strong>.</p>
          <p style="background-color: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 14px;">Timestamp: ${new Date().toLocaleString()}</p>
          <p style="color: #b91c1c; font-weight: bold; margin-top: 20px;">If you did not authorize this change, please contact our support center immediately.</p>
        </div>
      `;
      await Promise.all([
        sendEmail({ to: oldEmail, subject: "🔒 Security Alert: Account Email Changed", html: emailHtml }),
        sendEmail({ to: parsed.newEmail, subject: "🔒 Security Alert: Account Email Changed", html: emailHtml }),
      ]);
    } catch (err) {
      console.warn("Failed to send email change notification:", err.message);
    }
  }

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
      browser: true,
      os: true,
      location: true,
      createdAt: true,
      expiresAt: true,
      revoked: true,
      tokenHash: true,
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
      location: true,
      reason: true,
      riskLevel: true,
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

export const deleteUserAccount = async ({ currentPassword }, user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) throw toAuthError("User not found", 404);

  const passwordValid = await bcrypt.compare(currentPassword, existingUser.passwordHash);
  if (!passwordValid) throw toAuthError("Current password is incorrect", 401);

  await prisma.$transaction(async (tx) => {
    // 1. Delete refresh tokens
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });

    // 2. Clear userId references in LoginEvent
    await tx.loginEvent.updateMany({
      where: { userId: user.id },
      data: { userId: null }
    });

    // 3. Delete user's URLs (cascading to clicks, daily, and hourly stats)
    await tx.url.deleteMany({ where: { user_id: user.id } });

    // 4. Delete the User record
    await tx.user.delete({ where: { id: user.id } });
  });

  return true;
};

export const revokeAllSessionsUser = async (user) => {
  await incrementTokenVersion(user.id);
  await revokeRefreshTokensByUserId(user.id);
  return true;
};
