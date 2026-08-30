'use strict';

/**
 * Canonical zone names. These must stay in sync with:
 *  - The `zone` ENUM in the PollResponse model / migration
 *  - Location rows of type='zone' in the DB
 *
 * Single source of truth — import this constant anywhere you need to
 * validate or enumerate zones. Never write the list inline in a controller.
 */
const VALID_ZONES = Object.freeze(['masjid', 'boys_hostel', 'stanza', 'girls']);

module.exports = { VALID_ZONES };
