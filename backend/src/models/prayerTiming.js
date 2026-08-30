'use strict';

module.exports = (sequelize, DataTypes) => {
  const PrayerTiming = sequelize.define(
    'PrayerTiming',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      // The calendar date these timings belong to. One row per day.
      // Format: YYYY-MM-DD. Unique — enforced by index below.
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Bangalore',
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'India',
      },
      // Full timings blob as returned by AlAdhan API (or computed locally).
      // Stored as JSON so we never need to alter the schema when AlAdhan
      // adds new fields. Contains keys like Fajr, Dhuhr, Asr, Maghrib, Isha, etc.
      // All times are strings in "HH:MM" format (IST, 24h).
      timings: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      // Tahajjud is not in the AlAdhan response — we calculate it ourselves:
      // 2/3 of the night duration after Isha, before Fajr.
      // Stored as "HH:MM" IST string.
      tahajjud_time: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      // Imsak is the start of fasting (a few minutes before Fajr).
      // AlAdhan does return this; we pull it out for easy access.
      imsak_time: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
      // Islamic (Hijri) calendar date string, e.g. "15 Ramadan 1446".
      // Populated from AlAdhan response. Null when using local fallback.
      date_hijri: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      // Whether this row was fetched from AlAdhan (true) or calculated
      // locally via the adhan library as a fallback (false).
      // Useful for admin diagnostics.
      is_from_api: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      tableName: 'prayer_timings',
      indexes: [
        { unique: true, fields: ['date'] },
      ],
    }
  );

  // No associations — prayer timings are standalone daily records.

  return PrayerTiming;
};
