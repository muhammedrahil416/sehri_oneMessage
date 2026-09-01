'use strict';
const { verifyAccessToken } = require('../utils/jwt');
const { error } = require('../utils/response');

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches
 * the decoded payload to req.auth = { id, role, zone_location_id?, user_id? }.
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
 * requireRole('admin', 'super_admin') — only lets those roles through.
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

/**
 * requireUserAccess — allows the route if EITHER:
 *   a) the token role is 'user'  (regular user), OR
 *   b) the token role is 'admin' or 'super_admin' AND user_id is present
 *      (an admin/super_admin who also holds a linked user account).
 *
 * Also sets req.actingUserId to the correct users.id so controllers
 * don't have to repeat this logic. Use this on every route that was
 * previously guarded by requireRole('user').
 *
 * Must run after verifyToken.
 */
const requireUserAccess = (req, res, next) => {
  const { role, id, user_id } = req.auth;

  if (role === 'user') {
    // Regular user — their token id IS their users.id.
    req.actingUserId = id;
    return next();
  }

  if ((role === 'admin' || role === 'super_admin') && user_id) {
    // Admin/super_admin with a linked user account.
    req.actingUserId = user_id;
    return next();
  }

  return error(res, {
    statusCode: 403,
    message: 'You need a linked user account to perform this action',
  });
};

module.exports = { verifyToken, requireRole, requireUserAccess };
