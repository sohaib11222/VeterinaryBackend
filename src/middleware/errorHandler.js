const { sendError } = require('../utils/response');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId or our custom validation errors
  if (err.name === 'CastError' || (err.message && (err.message.includes('Invalid') || err.message.includes('is required')))) {
    // Check if it's a more specific error message from our validation
    const message = err.message && (err.message.includes('Invalid') || err.message.includes('is required'))
      ? err.message 
      : 'Invalid ID format or resource not found';
    error = { message, statusCode: 400 };
  }

  // Mongoose duplicate key (e.g. unique index violation)
  if (err.code === 11000) {
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field';
    const message = field === 'microchipNumber'
      ? 'A pet with this microchip number already exists. Leave it blank if the pet has no microchip.'
      : `${field} already exists`;
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
