'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const OTP_LENGTH = 6;
const SALT_ROUNDS = 10;

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 * Uses crypto.randomInt instead of Math.random() - Math.random() is not
 * cryptographically secure and its output can theoretically be predicted,
 * which matters for something guarding account access.
 */
const generateOtp = () => {
  const min = 10 ** (OTP_LENGTH - 1); // 100000
  const max = 10 ** OTP_LENGTH - 1; // 999999
  return crypto.randomInt(min, max + 1).toString();
};

/**
 * Hashes an OTP before it's stored. Same reasoning as password hashing:
 * if the otps table is ever leaked, plaintext codes are directly usable
 * for the (short) window before they expire - hashing removes that risk.
 */
const hashOtp = async (otp) => {
  return bcrypt.hash(otp, SALT_ROUNDS);
};

/**
 * Compares a plaintext OTP the user submitted against the stored hash.
 */
const compareOtp = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

module.exports = { generateOtp, hashOtp, compareOtp, OTP_LENGTH };
