'use strict';

const otpService = require('../services/otpService');
const { success } = require('../utils/response');

/**
 * POST /api/auth/send-otp
 * Body: { phone: string, purpose: 'registration' | 'forgot_password' }
 *
 * Generates and "sends" (console-logs, for now) an OTP for the given phone
 * number. Controller stays thin - all the actual logic lives in otpService
 * so it's reusable (the forgot-password flow can call this same service
 * function, just with a different `purpose`).
 *
 * Note: this file is deliberately separate from authController.js, which
 * is your teammate's file (registration logic) - keeping OTP logic here
 * avoids both of you editing the same file and hitting merge conflicts.
 */
const sendOtp = async (req, res, next) => {
  try {
    const { phone, purpose } = req.body;

    const result = await otpService.sendOtp(phone, purpose);

    return success(res, {
      statusCode: 200,
      message: 'OTP sent successfully.',
      data: { expiresInMinutes: result.expiresInMinutes },
    });
  } catch (err) {
    next(err); // handed to the global error handler in server.js
  }
};

module.exports = { sendOtp };
