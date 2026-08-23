'use strict';

const { validationResult } = require('express-validator');
const { error } = require('../utils/response');

/**
 * Runs after any express-validator validation chain(s) on a route.
 * If validation failed, responds with a 422 and a clear list of what's wrong.
 * If it passed, calls next() to proceed to the controller.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return error(res, {
      statusCode: 422,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { handleValidationErrors };
