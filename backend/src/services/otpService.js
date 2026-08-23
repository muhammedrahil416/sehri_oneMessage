'use strict';

const { Op } = require('sequelize');
const db = require('../models');
const { generateOtp, hashOtp } = require('../utils/otp');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Creates and "sends" an OTP for a given phone number and purpose.
 *
 * Flow:
 *  1. Reject if a still-valid OTP was requested too recently (cooldown) -
 *     prevents someone spamming this endpoint to burn SMS credits/quota.
 *  2. Invalidate any previous unused OTPs for this phone+purpose, so only
 *     the newest code can ever be verified successfully.
 *  3. Generate a new OTP, hash it, store the hash with an expiry.
 *  4. "Send" it - for now, log to console. Swap this for a real SMS
 *     provider call later without touching anything else in this function.
 *
 * @param {string} phone - 10-digit Indian mobile number
 * @param {'registration'|'forgot_password'} purpose
 * @param {'user'|'admin'|'super_admin'} role - defaults to 'user'
 */
const sendOtp = async (phone, purpose, role = 'user') => {
  const now = new Date();

  // Step 1: cooldown check - is there a recent, still-valid, unused OTP?
  const recentOtp = await db.OTP.findOne({
    where: {
      phone,
      purpose,
      is_used: false,
      expires_at: { [Op.gt]: now },
    },
    order: [['createdAt', 'DESC']],
  });

  if (recentOtp) {
    const secondsSinceSent = (now - new Date(recentOtp.createdAt)) / 1000;
    if (secondsSinceSent < RESEND_COOLDOWN_SECONDS) {
      const waitTime = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSinceSent);
      throw new AppError(
        `Please wait ${waitTime} second(s) before requesting another OTP.`,
        429
      );
    }
  }

  // Step 2: invalidate all previous unused OTPs for this phone+purpose
  await db.OTP.update(
    { is_used: true },
    { where: { phone, purpose, is_used: false } }
  );

  // Step 3: generate, hash, store
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

  await db.OTP.create({
    phone,
    otp_hash: otpHash,
    purpose,
    role,
    expires_at: expiresAt,
  });

  // Step 4: "send" - console-log for now (no real SMS provider wired up yet)
  logger.info(`📱 OTP for ${phone} [${purpose}]: ${otp} (expires in ${expiryMinutes} min)`);

  return { expiresInMinutes: expiryMinutes };
};

module.exports = { sendOtp, RESEND_COOLDOWN_SECONDS };
