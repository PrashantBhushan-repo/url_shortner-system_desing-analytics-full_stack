const SHORT_CODE_REGEX = /^[A-Za-z0-9]{3,10}$/;

export const validateShortCode = (shortCode) => {
  if (!shortCode || typeof shortCode !== "string") {
    return { valid: false, message: "Short code is required" };
  }

  if (!SHORT_CODE_REGEX.test(shortCode)) {
    return { valid: false, message: "Invalid short code format" };
  }

  return { valid: true };
};
