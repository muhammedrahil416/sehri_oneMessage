'use strict';

const { success, error } = require('../utils/response');
const { getPrayerTimings, getTodayISTString } = require('../services/prayerService');

// ---------------------------------------------------------------------------
// GET /api/prayers
// Access: any authenticated user
//
// Returns today's prayer timings. On first call of the day the service
// fetches from AlAdhan (or falls back to local calculation) and caches
// the result. Subsequent calls within the same day hit the DB cache.
//
// Response shape the frontend expects:
// {
//   date:          "2026-03-15"
//   date_hijri:    "15 Ramadan 1447"
//   is_from_api:   true
//   timings: {
//     Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha, ...  (all "HH:MM")
//   }
//   tahajjud_time: "02:14"
//   imsak_time:    "04:58"
// }
// ---------------------------------------------------------------------------
const getTodayPrayers = async (req, res) => {
  try {
    const record = await getPrayerTimings();

    return success(res, {
      statusCode: 200,
      message: 'Prayer timings fetched',
      data: formatRecord(record),
    });
  } catch (err) {
    console.error('getTodayPrayers error:', err);
    return error(res, { statusCode: 500, message: 'Failed to fetch prayer timings' });
  }
};

// ---------------------------------------------------------------------------
// POST /api/prayers/refresh
// Access: admin, super_admin
//
// Forces a fresh fetch from AlAdhan API, bypassing the DB cache.
// Useful when the admin notices the cached timings look wrong, or after a
// DST / timezone edge case.
//
// Also accepts an optional ?date=YYYY-MM-DD query param so the admin can
// refresh a specific date (e.g. tomorrow's timings before the cron runs).
// ---------------------------------------------------------------------------
const forceRefresh = async (req, res) => {
  try {
    const dateParam = req.query.date || null;

    // Validate the date param format if provided
    if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return error(res, {
        statusCode: 400,
        message: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const targetDate = dateParam || getTodayISTString();
    const record = await getPrayerTimings(targetDate, true); // forceRefresh = true

    return success(res, {
      statusCode: 200,
      message: `Prayer timings refreshed for ${targetDate}`,
      data: formatRecord(record),
    });
  } catch (err) {
    console.error('forceRefresh error:', err);
    return error(res, { statusCode: 500, message: 'Failed to refresh prayer timings' });
  }
};

// ---------------------------------------------------------------------------
// Internal: shape a PrayerTiming DB record into the API response format
// ---------------------------------------------------------------------------
const formatRecord = (record) => ({
  date: record.date,
  date_hijri: record.date_hijri,
  city: record.city,
  country: record.country,
  is_from_api: record.is_from_api,
  timings: record.timings,
  tahajjud_time: record.tahajjud_time,
  imsak_time: record.imsak_time,
});

module.exports = { getTodayPrayers, forceRefresh };
