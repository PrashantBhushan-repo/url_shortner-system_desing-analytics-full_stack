export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  const message =
    statusCode === 500 && !err.isOperational
      ? "Internal server error"
      : err.message;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};