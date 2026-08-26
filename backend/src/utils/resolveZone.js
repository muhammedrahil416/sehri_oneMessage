'use strict';

/**
 * Given any location_id (which may be a 'zone' row itself, e.g. Masjid,
 * or an 'address' row under Stanza, e.g. "Target PG"), walk up the
 * parent chain and return the nearest ancestor of type='zone'.
 *
 * Returns the Location instance for the zone, or null if none found
 * (shouldn't happen for valid data, but we don't want to throw here).
 */
const resolveZone = async (locationId, db) => {
  const { Location } = db;

  let current = await Location.findByPk(locationId);
  let hops = 0;
  const MAX_HOPS = 10; // safety guard against any accidental cycle

  while (current && current.type !== 'zone' && hops < MAX_HOPS) {
    if (!current.parent_id) return null;
    current = await Location.findByPk(current.parent_id);
    hops += 1;
  }

  if (!current || current.type !== 'zone') return null;
  return current;
};

module.exports = { resolveZone };