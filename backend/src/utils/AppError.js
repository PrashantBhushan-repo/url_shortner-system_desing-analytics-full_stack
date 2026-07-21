export class AppError extends Error {
  constructor(message, statusCode = 500, details = null, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details; // Additional error details (e.g., validation errors)
    this.errorCode = errorCode;
  }
}