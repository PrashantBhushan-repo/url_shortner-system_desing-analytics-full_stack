import { randomInt } from "node:crypto";

export const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const SHORT_CODE_LENGTH = 7;

// randomInt uses unbiased sampling over the alphabet; seven characters give 62^7 possibilities.
export function generateShortCode(length = SHORT_CODE_LENGTH) {
  if (!Number.isInteger(length) || length < 1 || length > 64) throw new RangeError("Short code length must be an integer from 1 to 64");
  return Array.from({ length }, () => BASE62_ALPHABET[randomInt(BASE62_ALPHABET.length)]).join("");
}

export function isShortCodeConflict(error) {
  return error?.code === "23505" && (!error.constraint || /short.?code/i.test(error.constraint));
}

// The database UNIQUE constraint arbitrates concurrent requests; never rely on a pre-check.
export async function insertWithUniqueCode(insert, generate = generateShortCode, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await insert(generate()); }
    catch (error) { if (!isShortCodeConflict(error)) throw error; }
  }
  const error = new Error("Unable to allocate a unique short code. Please try again.");
  error.statusCode = 503;
  throw error;
}
