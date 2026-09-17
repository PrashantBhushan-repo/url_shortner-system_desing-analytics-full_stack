const SHORT_CODE_REGEX = /^[A-Za-z0-9_-]{3,64}$/;

export const validateShortCode = (shortCode) => {
  if (!shortCode || typeof shortCode !== "string") {
    return { valid: false, message: "Short code is required" };
  }

  if (!SHORT_CODE_REGEX.test(shortCode.trim())) {
    return {
      valid: false,
      message: "Invalid short code format. Must be 3-64 alphanumeric characters, hyphens (-), or underscores (_).",
    };
  }

  return { valid: true };
};
