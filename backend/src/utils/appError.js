'use strict';

/**
 * An error that carries an HTTP status code, so the global error handler
 * in server.js can respond with the right status instead of always 500.
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
