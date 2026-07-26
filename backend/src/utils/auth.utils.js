import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { AppError } from "./AppError.js";

export const SALT_ROUNDS = 10;

export const getJwtSecret = () => {
  const secret = config.jwt.secret;
  if (!secret && config.nodeEnv === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return secret || "dev-secret";
};

export const generateOtp = () => crypto.randomInt(100000, 999999).toString();

export const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const createAccessToken = (user) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    getJwtSecret(),
    { expiresIn: config.jwt.accessExpiresIn },
  );

export const getRequestMeta = (req = {}) => ({
  device: req.headers?.["user-agent"] || "unknown",
  ip: req.ip || req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown",
});

export const toAuthError = (message, statusCode = 400) => new AppError(message, statusCode);

const getEncryptionKey = () =>
  crypto.createHash("sha256").update(`${getJwtSecret()}:2fa`).digest();

export const encryptSecret = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const decryptSecret = (payload) => {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};
