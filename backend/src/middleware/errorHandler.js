import ApiError from '../utils/ApiError.js';

const errorHandler = (err, req, res, next) => {
  const isTrustedError = err instanceof ApiError;

  const statusCode = isTrustedError
    ? err.statusCode
    : 500;

  if (!isTrustedError) {
    console.error('Unexpected server error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isTrustedError
      ? err.message
      : 'Internal Server Error',
  });
};

export default errorHandler;