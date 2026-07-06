export const validateUrl = (input) => {
    if (!input || typeof input !== "string") {
      return { valid: false, message: "URL is required" };
    }
  
    const trimmed = input.trim();
  
    if (trimmed.length > 2048) {
      return { valid: false, message: "URL is too long (max 2048 characters)" };
    }
  
    let parsed;
  
    try {
      parsed = new URL(trimmed);
    } catch {
      return { valid: false, message: "Invalid URL format" };
    }
  
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, message: "Only http and https URLs are allowed" };
    }
  
    if (!parsed.hostname) {
      return { valid: false, message: "Invalid URL hostname" };
    }
  
    return { valid: true, normalizedUrl: parsed.href };
  };