'use strict';

const express = require('express');
const { getLocations } = require('../controllers/locationController');

const router = express.Router();

// Public — no auth required; registration screen needs this before any token exists
router.get('/', getLocations);

module.exports = router;
