'use strict';

/**
 * prayerService.js
 *
 * Responsible for fetching, calculating, and caching daily prayer timings.
 *
 * Strategy:
 *  1. Try AlAdhan API (https://aladhan.com/prayer-times-api) — free, no key needed.
 *  2. If the API is unreachable or returns an error, fall back to local
 *     calculation using the `adhan` npm library.
 *  3. Either way, upsert the result into the `prayer_timings` DB table so
 *     subsequent reads are just a DB lookup — no repeated API calls.
 *
 * Tahajjud calculation:
 *  Not provided by AlAdhan. We compute it as the point 2/3 through the
 *  night duration (from Isha to Fajr next day). This is the common
 *  scholarly opinion used by most Islamic apps.
 */

const axios = require('axios');
const { Coordinates, CalculationMethod, PrayerTimes, SunnahTimes } = require('adhan');
const db = require('../models');
const logger = require('../utils/logger');

const { PrayerTiming } = db;

// ---------------------------------------------------------------------------
// Location config — read from environment so the app is deployable to any
// city without touching source code. See .env.example for required keys.
// ---------------------------------------------------------------------------
const LATITUDE = parseFloat(process.env.PRAYER_LATITUDE || '12.9716');
const LONGITUDE = parseFloat(process.env.PRAYER_LONGITUDE || '77.5946');
const CITY = process.env.PRAYER_CITY || 'Bangalore';
const COUNTRY = process.env.PRAYER_COUNTRY || 'India';
const TIMEZONE = process.env.PRAYER_TIMEZONE || 'Asia/Kolkata';

// AlAdhan API — Method 1 = University of Islamic Sciences, Karachi
// (widely used in South Asia). No API key needed.
const ALADHAN_URL = 'https://api.aladhan.com/v1/timingsByCity';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the date string for today in the configured timezone (YYYY-MM-DD).
 * en-CA locale gives YYYY-MM-DD format natively without any slicing.
 */
const getTodayISTString = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });

/**
 * Parses a time string like "04:32 (IST)" or "04:32" and returns "HH:MM".
 * AlAdhan appends timezone info in parentheses — we strip it.
 */
const cleanTime = (timeStr) => {
  if (!timeStr) return null;
  return timeStr.split(' ')[0].trim(); // "04:32 (IST)" → "04:32"
};

/**
 * Converts a Date object to an "HH:MM" string in the configured timezone.
 * Used to format times produced by the local adhan library.
 */
const dateToISTString = (date) => {
  if (!date || isNaN(date)) return null;
  return date.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }); // returns "HH:MM"
};

/**
 * Calculates Tahajjud time: 2/3 of the night after Isha, before Fajr.
 *
 * @param {string} ishaTime   - "HH:MM" of tonight's Isha
 * @param {string} fajrTime   - "HH:MM" of tomorrow's Fajr
 * @returns {string|null}     - "HH:MM" of Tahajjud time, or null on error
 */
const calculateTahajjud = (ishaTime, fajrTime) => {
  try {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [ishaH, ishaM] = ishaTime.split(':').map(Number);
    const [fajrH, fajrM] = fajrTime.split(':').map(Number);

    // Build Date objects for Isha (tonight) and Fajr (tomorrow morning).
    // We use UTC midnight as a base and add the IST offset (UTC+5:30 = 330 min).
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

    const ishaDate = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
        IST_OFFSET_MS +
        (ishaH * 60 + ishaM) * 60 * 1000
    );
    const fajrDate = new Date(
      Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()) -
        IST_OFFSET_MS +
        (fajrH * 60 + fajrM) * 60 * 1000
    );

    const nightDurationMs = fajrDate - ishaDate;
    // 2/3 of the night duration after Isha
    const tahajjudMs = ishaDate.getTime() + (nightDurationMs * 2) / 3;
    const tahajjudDate = new Date(tahajjudMs);

    return dateToISTString(tahajjudDate);
  } catch (err) {
    logger.error(`calculateTahajjud error: ${err.message}`);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Primary: Fetch from AlAdhan API
// ---------------------------------------------------------------------------

/**
 * Fetches prayer timings from AlAdhan API for a given date string (YYYY-MM-DD).
 * Returns a structured object ready for DB insertion, or throws on failure.
 */
const fetchFromAlAdhan = async (dateStr) => {
  const [year, month, day] = dateStr.split('-');

  const response = await axios.get(ALADHAN_URL, {
    params: {
      city: CITY,
      country: COUNTRY,
      method: 1,       // University of Islamic Sciences, Karachi
      date: `${day}-${month}-${year}`, // AlAdhan expects DD-MM-YYYY
    },
    timeout: 8000,     // 8s — if it hasn't responded by then, use fallback
  });

  const data = response.data;

  if (data.code !== 200 || !data.data) {
    throw new Error(`AlAdhan API returned unexpected response: code ${data.code}`);
  }

  const { timings, date } = data.data;

  // Clean all time strings (strip timezone suffix AlAdhan appends)
  const cleanedTimings = {};
  for (const [key, val] of Object.entries(timings)) {
    cleanedTimings[key] = cleanTime(val);
  }

  const ishaTime = cleanedTimings.Isha;
  const fajrTime = cleanedTimings.Fajr;
  const tahajjud = calculateTahajjud(ishaTime, fajrTime);

  // Hijri date from AlAdhan response
  const hijri = date?.hijri;
  const dateHijri = hijri
    ? `${hijri.day} ${hijri.month?.en} ${hijri.year}`
    : null;

  return {
    date: dateStr,
    city: CITY,
    country: COUNTRY,
    timings: cleanedTimings,
    tahajjud_time: tahajjud,
    imsak_time: cleanedTimings.Imsak || null,
    date_hijri: dateHijri,
    is_from_api: true,
  };
};

// ---------------------------------------------------------------------------
// Fallback: Calculate locally using adhan library
// ---------------------------------------------------------------------------

/**
 * Calculates prayer timings locally using the `adhan` library.
 * Used when AlAdhan API is unreachable.
 * Returns the same structured object shape as fetchFromAlAdhan().
 */
const calculateLocally = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);

  const coords = new Coordinates(LATITUDE, LONGITUDE);
  const params = CalculationMethod.Karachi(); // matches AlAdhan method 1

  // adhan month is 0-indexed
  const prayerDate = new Date(year, month - 1, day);
  const prayers = new PrayerTimes(coords, prayerDate, params);
  const sunnah = new SunnahTimes(prayers);

  const timings = {
    Fajr: dateToISTString(prayers.fajr),
    Sunrise: dateToISTString(prayers.sunrise),
    Dhuhr: dateToISTString(prayers.dhuhr),
    Asr: dateToISTString(prayers.asr),
    Maghrib: dateToISTString(prayers.maghrib),
    Isha: dateToISTString(prayers.isha),
    // adhan doesn't produce Imsak or Midnight by default — set to null
    Imsak: null,
    Midnight: dateToISTString(sunnah.middleOfTheNight),
  };

  const tahajjud = timings.Isha && timings.Fajr
    ? calculateTahajjud(timings.Isha, timings.Fajr)
    : null;

  return {
    date: dateStr,
    city: CITY,
    country: COUNTRY,
    timings,
    tahajjud_time: tahajjud,
    imsak_time: null,   // not available from local calculation
    date_hijri: null,   // not available from local calculation
    is_from_api: false,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches (or retrieves from cache) prayer timings for the given date.
 *
 * @param {string} dateStr - YYYY-MM-DD. Defaults to today in configured timezone.
 * @param {boolean} forceRefresh - If true, skips DB cache and re-fetches.
 * @returns {object} The PrayerTiming model instance.
 */
const getPrayerTimings = async (dateStr = null, forceRefresh = false) => {
  const date = dateStr || getTodayISTString();

  // 1. Return cached record unless force-refresh was requested
  if (!forceRefresh) {
    const cached = await PrayerTiming.findOne({ where: { date } });
    if (cached) return cached;
  }

  // 2. Try AlAdhan API first, fall back to local calculation
  let timingData;
  try {
    timingData = await fetchFromAlAdhan(date);
    logger.info(`[prayerService] Fetched timings from AlAdhan API for ${date}`);
  } catch (err) {
    logger.warn(`[prayerService] AlAdhan API failed (${err.message}), using local fallback`);
    timingData = calculateLocally(date);
  }

  // 3. Upsert — update existing row or create a new one
  const [record] = await PrayerTiming.upsert(timingData, {
    returning: true,
  });

  return record;
};

/**
 * Convenience: fetch and cache tomorrow's timings.
 * Called by the 12:05 AM cron job.
 */
const fetchTomorrowTimings = async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return getPrayerTimings(tomorrowStr, true);
};

module.exports = {
  getPrayerTimings,
  fetchTomorrowTimings,
  getTodayISTString,
};
