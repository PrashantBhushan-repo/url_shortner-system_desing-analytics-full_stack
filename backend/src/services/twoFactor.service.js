import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import { getRedisClient } from "../config/redisClient.js";
import { findUserById, updateUserProfile } from "../repositories/user.repository.js";
import { AppError } from "../utils/AppError.js";
import { decryptSecret, encryptSecret, toAuthError } from "../utils/auth.utils.js";

const APP_NAME = "SnapURL";
const PENDING_2FA_TTL_SECONDS = 60 * 10;
const pendingSetupKey = (userId) => `2fa_setup:${userId}`;

const verifyTotp = (secret, token) =>
  verifySync({ secret, token, epochTolerance: 1 }).valid;

const getStoredSecret = (user) => {
  if (!user.twoFactorSecret) {
    return null;
  }
  return decryptSecret(user.twoFactorSecret);
};

export const setupTwoFactor = async (user) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) {
    throw toAuthError("User not found", 404);
  }

  if (existingUser.twoFactorEnabled) {
    throw new AppError("Two-factor authentication is already enabled", 400);
  }

  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: APP_NAME,
    label: existingUser.email,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  const client = getRedisClient();
  await client.set(pendingSetupKey(user.id), secret, "EX", PENDING_2FA_TTL_SECONDS);

  return {
    qrCodeDataUrl,
    manualEntryKey: secret,
    otpauthUrl,
  };
};

const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    const part1 = crypto.randomBytes(3).toString("hex");
    const part2 = crypto.randomBytes(3).toString("hex");
    codes.push(`${part1}-${part2}`);
  }
  return codes;
};

export const enableTwoFactor = async (user, otp) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) {
    throw toAuthError("User not found", 404);
  }

  if (existingUser.twoFactorEnabled) {
    throw new AppError("Two-factor authentication is already enabled", 400);
  }

  const client = getRedisClient();
  const pendingSecret = await client.get(pendingSetupKey(user.id));
  if (!pendingSecret) {
    throw toAuthError("Setup expired. Generate a new QR code and try again.", 400);
  }

  const isValid = verifyTotp(pendingSecret, otp);
  if (!isValid) {
    throw toAuthError("Invalid authenticator code", 400);
  }

  const plaintextCodes = generateBackupCodes();
  const hashedCodes = plaintextCodes.map(code => 
    crypto.createHash("sha256").update(code.replace("-", "")).digest("hex")
  );

  await updateUserProfile(user.id, {
    twoFactorEnabled: true,
    twoFactorSecret: encryptSecret(pendingSecret),
    twoFactorBackupCodes: JSON.stringify(hashedCodes),
  });
  await client.del(pendingSetupKey(user.id));

  return { twoFactorEnabled: true, backupCodes: plaintextCodes };
};

export const disableTwoFactor = async (user, otp) => {
  const existingUser = await findUserById(user.id);
  if (!existingUser) {
    throw toAuthError("User not found", 404);
  }

  if (!existingUser.twoFactorEnabled || !existingUser.twoFactorSecret) {
    throw new AppError("Two-factor authentication is not enabled", 400);
  }

  const secret = getStoredSecret(existingUser);
  const isValid = verifyTotp(secret, otp);
  if (!isValid) {
    throw toAuthError("Invalid authenticator code", 400);
  }

  await updateUserProfile(user.id, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
  });

  return { twoFactorEnabled: false };
};

export const verifyTwoFactorLogin = async (userId, otp) => {
  const user = await findUserById(userId);
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw toAuthError("Two-factor authentication is not enabled for this account", 400);
  }

  const secret = getStoredSecret(user);
  const isValid = verifyTotp(secret, otp);
  if (!isValid) {
    throw toAuthError("Invalid authenticator code", 400);
  }

  return true;
};
