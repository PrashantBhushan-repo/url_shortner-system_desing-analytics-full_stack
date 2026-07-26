import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UAParser } from "ua-parser-js";
import { config } from "../config/config.js";
import { AppError } from "./AppError.js";
import { resolveGeoLocation } from "./location.js";

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

export const createAccessToken = (user) => {
  const expiresIn = user.role === "ADMIN" ? "10m" : (config.jwt.accessExpiresIn || "15m");
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    },
    getJwtSecret(),
    { expiresIn },
  );
};

export const getRequestMeta = (req = {}) => ({
  device: req.headers?.["user-agent"] || "unknown",
  ip: req.ip || req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown",
});

export const parseRequestMeta = async (req = {}) => {
  const ua = req.headers?.["user-agent"] || "unknown";
  const ip = req.ip || req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";

  const parser = new UAParser(ua);
  const parsed = parser.getResult();

  // Extract friendly browser and OS strings
  const browserName = parsed.browser.name || "";
  const browserVer = parsed.browser.version || "";
  const browser = browserName ? `${browserName} ${browserVer}`.trim() : "Unknown Browser";

  const osName = parsed.os.name || "";
  const osVer = parsed.os.version || "";
  const os = osName ? `${osName} ${osVer}`.trim() : "Unknown OS";

  // Friendly device display name
  let device = "Desktop";
  if (parsed.device.type === "mobile") {
    device = parsed.device.model || "Mobile Device";
  } else if (parsed.device.type === "tablet") {
    device = parsed.device.model || "Tablet Device";
  } else if (parsed.device.model) {
    device = parsed.device.model;
  }

  // Resolve GeoIP Location
  let location = "Unknown Location";
  try {
    const geo = await resolveGeoLocation(ip);
    if (geo) {
      const parts = [];
      if (geo.city) parts.push(geo.city);
      if (geo.region && geo.region !== geo.city) parts.push(geo.region);
      if (geo.country) parts.push(geo.country);
      location = parts.length > 0 ? parts.join(", ") : "Unknown Location";
    } else if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
      location = "Local Network (Loopback)";
    }
  } catch (err) {
    console.warn("Failed to resolve GeoIP location:", err.message);
  }

  return {
    device,
    ip,
    browser,
    os,
    location,
  };
};

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
