/**
 * Standardized API response helpers.
 * Every endpoint in this project should respond through these,
 * so the mobile team always receives a predictable shape.
 */

const success = (res, { statusCode = 200, message = 'Success', data = null }) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const error = (res, { statusCode = 500, message = 'Something went wrong', errors = null }) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { success, error };
