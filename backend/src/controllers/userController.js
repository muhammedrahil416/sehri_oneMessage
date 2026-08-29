'use strict';

const db = require('../models');
const { success, error } = require('../utils/response');
const { resolveZone } = require('../utils/resolveZone');

const { User, Location } = db;

/**
 * GET /api/users?status=pending
 * - super_admin: sees users across all zones
 * - admin: sees only users whose location resolves up to their own zone
 *
 * Since location_id can point to either a zone row directly (Masjid,
 * Boys Hostel, Girls) or an address row under Stanza, we can't filter
 * with a simple WHERE location_id = :zone. Instead we fetch the
 * candidate users along with their location, then resolve each one's
 * zone in application code and filter there.
 */
const listUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const { role, zone_location_id } = req.auth;

    const where = {};
    if (status) {
      where.status = status;
    }

    const users = await User.findAll({
      where,
      include: [{ model: Location, as: 'location' }],
      order: [['createdAt', 'DESC']],
    });

    if (role === 'super_admin') {
      return success(res, {
        statusCode: 200,
        message: 'Users fetched successfully',
        data: users,
      });
    }

    // role === 'admin' -> filter to only this admin's zone
    const filtered = [];
    for (const user of users) {
      const zone = await resolveZone(user.location_id, db);
      if (zone && zone.id === zone_location_id) {
        filtered.push(user);
      }
    }

    return success(res, {
      statusCode: 200,
      message: 'Users fetched successfully',
      data: filtered,
    });
  } catch (err) {
    console.error('List users error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

/**
 * PATCH /api/users/:id/status
 * Body: { status: 'approved' | 'rejected' }
 *
 * An admin may only approve/reject users within their own zone.
 * A super_admin may act on anyone.
 */
const updateUserStatus = async (req, res) => {
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

    const user = await User.findByPk(id);

    if (!user) {
      return error(res, { statusCode: 404, message: 'User not found' });
    }

    if (role === 'admin') {
      const zone = await resolveZone(user.location_id, db);
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
    console.error('Update user status error:', err);
    return error(res, { statusCode: 500, message: 'Server error' });
  }
};

module.exports = { listUsers, updateUserStatus };