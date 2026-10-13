class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);

    if (
      !Number.isInteger(statusCode) ||
      statusCode < 400 ||
      statusCode > 599
    ) {
      throw new TypeError('Invalid HTTP error status code');
    }

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.success = false;

    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;