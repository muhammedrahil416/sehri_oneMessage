'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/response');

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches
 * the decoded payload to req.auth = { id, role, zone_location_id? }.
 */
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return error(res, {
      statusCode: 401,
      message: 'Missing or malformed Authorization header',
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    return next();
  } catch (err) {
    return error(res, {
      statusCode: 401,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * requireRole('admin', 'super_admin') -> only lets those roles through.
 * Must run after verifyToken.
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      return error(res, {
        statusCode: 403,
        message: 'You do not have permission to perform this action',
      });
    }
    return next();
  };
};

module.exports = { verifyToken, requireRole };