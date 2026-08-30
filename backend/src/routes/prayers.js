'use strict';

const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/auth');
const { getTodayPrayers, forceRefresh } = require('../controllers/prayerController');

// GET /api/prayers
// Returns today's prayer schedule with Hijri date, Tahajjud, and Imsak.
// All authenticated roles can call this.
router.get('/', verifyToken, getTodayPrayers);

// POST /api/prayers/refresh
// Force-fetches from AlAdhan API, bypassing the DB cache.
// Optional query param: ?date=YYYY-MM-DD to refresh a specific date.
// Admin and super_admin only.
router.post('/refresh', verifyToken, requireRole('admin', 'super_admin'), forceRefresh);

module.exports = router;
