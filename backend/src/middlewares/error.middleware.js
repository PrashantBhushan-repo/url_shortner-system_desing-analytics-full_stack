export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  console.error(`[Error ${statusCode}]`, err.message);
  if (statusCode >= 500) {
    console.error(err.stack);
  }

  let message = err.message;
  let details = err.details || null;

  if (statusCode === 400) {
    message = message || "Validation failed";
  } else if (statusCode === 404) {
    message = message || "Resource not found";
  } else if (statusCode === 409) {
    message = message || "Conflict";
  } else if (statusCode === 410) {
    message = message || "Resource is no longer available";
  } else if (statusCode === 429) {
    message = message || "Too many requests";
  } else if (statusCode >= 500) {
    message = "Internal server error";
    details = null;
  }

  if (err?.code && err.code.startsWith("23")) {
    console.error("PostgreSQL error:", err.code, err.detail || err.message);
    message = "Database error occurred";
    details = null;
  }

  const response = {
    success: false,
    message,
  };

  if (statusCode === 400 && details) {
    response.details = details;
  }

  if (statusCode === 429) {
    const retryAfter = err.retryAfter || 60;
    res.setHeader("Retry-After", retryAfter);
  }

  res.status(statusCode).json(response);
};