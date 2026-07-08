import { randomBytes } from "crypto";

// Base62 character set: 0-9, A-Z, a-z (62 characters)
const BASE62_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE62_LENGTH = BASE62_CHARS.length;
const SHORT_CODE_LENGTH = 7;

/**
 * Generate a random Base62 short code of specified length
 * Uses crypto.randomBytes for cryptographically secure random generation
 * @param {number} length - Length of the short code (default 7)
 * @returns {string} - Base62 encoded short code
 */
export const generateShortCode = (length = SHORT_CODE_LENGTH) => {
  const bytes = randomBytes(length);
  let code = "";
  
  for (let i = 0; i < length; i++) {
    // Use each byte to index into Base62 character set
    const index = bytes[i] % BASE62_LENGTH;
    code += BASE62_CHARS[index];
  }
  
  return code;
};