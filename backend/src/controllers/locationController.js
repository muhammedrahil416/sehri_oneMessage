'use strict';

const db = require('../models');
const { success, error } = require('../utils/response');

const { Location } = db;

/**
 * GET /api/locations?type=zone&parent_id=<uuid>
 *
 * Returns active locations, optionally filtered by type and/or parent_id.
 * Used by the registration screen to build the cascading
 * city → area → zone → address picker without hardcoding anything.
 *
 * Examples:
 *   GET /api/locations?type=city              → all cities
 *   GET /api/locations?type=zone              → all zones
 *   GET /api/locations?type=address&parent_id=<zone-id>  → addresses under a zone
 */
const getLocations = async (req, res, next) => {
  try {
    const { type, parent_id } = req.query;

    const where = { is_active: true };
    if (type) where.type = type;
    if (parent_id) where.parent_id = parent_id;

    const locations = await Location.findAll({
      where,
      attributes: ['id', 'name', 'type', 'parent_id'],
      order: [['name', 'ASC']],
    });

    return success(res, {
      statusCode: 200,
      message: 'Locations fetched successfully',
      data: locations,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLocations };
