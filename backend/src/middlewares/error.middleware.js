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

  const getErrorCode = (status) => {
    switch (status) {
      case 400: return "BAD_REQUEST";
      case 401: return "UNAUTHORIZED";
      case 403: return "FORBIDDEN";
      case 404: return "NOT_FOUND";
      case 409: return "CONFLICT";
      case 410: return "GONE";
      case 429: return "TOO_MANY_REQUESTS";
      default: return "INTERNAL_SERVER_ERROR";
    }
  };

  const response = {
    success: false,
    message,
    code: err.errorCode || getErrorCode(statusCode),
  };

  if (details) {
    response.details = details;
  }

  if (statusCode === 429) {
    const retryAfter = err.retryAfter || 60;
    res.setHeader("Retry-After", retryAfter);
  }

  res.status(statusCode).json(response);
};