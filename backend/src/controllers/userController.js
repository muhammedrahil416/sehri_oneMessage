'use strict';

const db = require('../models');
const { success, error } = require('../utils/response');

const { User, Location } = db;

/**
 * Resolves a zone location_id from a preloaded location chain (in memory).
 * Walks up the `parent` association chain already eager-loaded by Sequelize,
 * so no additional DB queries are made per user.
 *
 * @param {object} location - The Location instance already loaded with its
 *                            nested `parent` association (up to MAX_DEPTH levels).
 * @returns {object|null}   - The zone-type Location instance, or null if none found.
 */
const resolveZoneFromLoaded = (location) => {
  let current = location;
  let hops = 0;
  const MAX_HOPS = 10;

  while (current && current.type !== 'zone' && hops < MAX_HOPS) {
    current = current.parent || null;
    hops += 1;
  }

  return current && current.type === 'zone' ? current : null;
};

/**
 * Builds a nested Sequelize include for Location → parent → parent → ...
 * up to `depth` levels deep. This lets us load the entire ancestor chain
 * in a single JOIN rather than N individual queries per user.
 */
const buildLocationInclude = (depth = 5) => {
  let include = null;
  for (let i = 0; i < depth; i++) {
    include = {
      model: Location,
      as: 'parent',
      required: false,
      attributes: ['id', 'name', 'type', 'parent_id'],
      ...(include ? { include: [include] } : {}),
    };
  }
  return {
    model: Location,
    as: 'location',
    required: false,
    attributes: ['id', 'name', 'type', 'parent_id'],
    include: include ? [include] : [],
  };
};

/**
 * GET /api/users?status=pending
 * - super_admin: sees users across all zones
 * - admin: sees only users whose location resolves up to their own zone
 *
 * The location parent chain is eager-loaded in one query, then zone
 * resolution happens in application memory — no N+1 DB queries.
 */
const listUsers = async (req, res, next) => {
  try {
    const { status } = req.query;
    const { role, zone_location_id } = req.auth;

    const where = {};
    if (status) {
      where.status = status;
    }

    // Eager-load the full location ancestor chain so we can resolve zones
    // in memory without issuing a DB query per user.
    const users = await User.findAll({
      where,
      include: [buildLocationInclude()],
      order: [['createdAt', 'DESC']],
    });

    if (role === 'super_admin') {
      return success(res, {
        statusCode: 200,
        message: 'Users fetched successfully',
        data: users,
      });
    }

    // role === 'admin' -> filter to only this admin's zone using in-memory resolution
    const filtered = users.filter((user) => {
      const zone = resolveZoneFromLoaded(user.location);
      return zone && zone.id === zone_location_id;
    });

    return success(res, {
      statusCode: 200,
      message: 'Users fetched successfully',
      data: filtered,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/status
 * Body: { status: 'approved' | 'rejected' }
 *
 * An admin may only approve/reject users within their own zone.
 * A super_admin may act on anyone.
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { role, zone_location_id } = req.auth;

    if (!['approved', 'rejected'].includes(status)) {
      return error(res, {
        statusCode: 400,
        message: "Status must be 'approved' or 'rejected'",
      });
    }

    const user = await User.findByPk(id, {
      include: [buildLocationInclude()],
    });

    if (!user) {
      return error(res, { statusCode: 404, message: 'User not found' });
    }

    if (role === 'admin') {
      const zone = resolveZoneFromLoaded(user.location);
      if (!zone || zone.id !== zone_location_id) {
        return error(res, {
          statusCode: 403,
          message: 'You can only manage users in your own zone',
        });
      }
    }

    user.status = status;
    await user.save();

    return success(res, {
      statusCode: 200,
      message: `User ${status} successfully`,
      data: { id: user.id, status: user.status },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listUsers, updateUserStatus };
