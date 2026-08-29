'use strict';

const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const otpController = require('../controllers/otpController');
const { handleValidationErrors } = require('../middleware/otpValidation');

const router = express.Router();

// A second layer of abuse protection, at the IP level (on top of the
// per-phone cooldown already enforced inside otpService). Prevents a
// single client from hammering this endpoint across many different
// phone numbers.
const sendOtpLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 10) || 15) * 60 * 1000,
  max: 10, // 10 OTP requests per window per IP
  message: {
    success: false,
    message: 'Too many OTP requests from this device. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendOtpValidation = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Phone must be a valid 10-digit Indian mobile number.'),
  body('purpose')
    .isIn(['registration', 'forgot_password'])
    .withMessage("Purpose must be 'registration' or 'forgot_password'."),
];

router.post(
  '/send-otp',
  sendOtpLimiter,
  sendOtpValidation,
  handleValidationErrors,
  otpController.sendOtp
);

module.exports = router;
