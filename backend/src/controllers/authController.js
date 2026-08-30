'use strict';
const bcrypt = require('bcryptjs');
const db = require('../models');
const otpService = require('../services/otpService');
const { success, error } = require('../utils/response');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const { User, Location, Admin, SuperAdmin } = db;
const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      password,
      gender,
      occupation,
      city,
      location_id,
      address,
      otp,
    } = req.body;
    // 1 & 2. Verify OTP — handles lookup, expiry, attempt-limiting, and
    // provider branching (local vs MessageCentral) internally.
    // verifyOtp throws AppError on known failures (expired, too many attempts).
    const isOtpValid = await otpService.verifyOtp(phone, 'registration', otp);
    if (!isOtpValid) {
      return error(res, {
        statusCode: 400,
        message: 'Invalid OTP',
      });
    }
    // 3. Check whether phone is already registered
    const existingUser = await User.findOne({
      where: { phone },
    });
    if (existingUser) {
      return error(res, {
        statusCode: 409,
        message: 'Phone number is already registered',
      });
    }
    // 4. Check whether location exists and is a valid registration target
    //    (a 'zone' or 'address' row — not 'city'/'area', which are just
    //    structural grouping levels).
    const location = await Location.findByPk(location_id);
    if (!location || !['zone', 'address'].includes(location.type)) {
      return error(res, {
        statusCode: 400,
        message: 'Invalid location',
      });
    }
    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // 6. Create user
    const user = await User.create({
      name,
      phone,
      password: hashedPassword,
      gender,
      occupation,
      city,
      location_id,
      address,
      status: 'pending',
      is_phone_verified: true,
    });
    // 7. Send response
    return success(res, {
      statusCode: 201,
      message: 'Registration successful',
      data: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        status: user.status,
        is_phone_verified: user.is_phone_verified,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Body: { phone, password }
 *
 * Server auto-detects role by checking super_admins -> admins -> users,
 * in that order (highest privilege first, first match wins). The client
 * never declares its own role.
 */
const loginUser = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return error(res, {
        statusCode: 400,
        message: 'Phone and password are required',
      });
    }

    let account = await SuperAdmin.scope('withPassword').findOne({ where: { phone } });
    let role = 'super_admin';

    if (!account) {
      account = await Admin.scope('withPassword').findOne({ where: { phone } });
      role = 'admin';
    }

    if (!account) {
      account = await User.scope('withPassword').findOne({ where: { phone } });
      role = 'user';
    }

    if (!account) {
      return error(res, {
        statusCode: 401,
        message: 'Invalid phone or password',
      });
    }

    if (account.is_active === false) {
      return error(res, {
        statusCode: 403,
        message: 'This account has been deactivated',
      });
    }

    if (role === 'user' && account.status !== 'approved') {
      return error(res, {
        statusCode: 403,
        message:
          account.status === 'pending'
            ? 'Your account is still pending approval'
            : 'Your account registration was rejected',
      });
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);

    if (!isPasswordValid) {
      return error(res, {
        statusCode: 401,
        message: 'Invalid phone or password',
      });
    }

    const tokenPayload = { id: account.id, role };
    if (role === 'admin') {
      tokenPayload.zone_location_id = account.zone_location_id;
    }

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    if ('last_login_at' in account.dataValues) {
      account.last_login_at = new Date();
      await account.save();
    }

    return success(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        role,
        profile: {
          id: account.id,
          name: account.name,
          phone: account.phone,
          ...(role === 'admin' ? { zone_location_id: account.zone_location_id } : {}),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password/verify-otp
 * Body: { phone, otp, newPassword }
 *
 * Single endpoint that:
 *  1. Verifies the forgot_password OTP (marks it used on success)
 *  2. Finds the account across super_admins → admins → users
 *  3. Hashes and saves the new password
 *
 * The OTP was previously requested via POST /api/auth/send-otp
 * with purpose = 'forgot_password'.
 */
const forgotPasswordReset = async (req, res, next) => {
  try {
    const { phone, otp, newPassword } = req.body;

    if (!phone || !otp || !newPassword) {
      return error(res, {
        statusCode: 400,
        message: 'Phone, OTP, and new password are required',
      });
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return error(res, {
        statusCode: 400,
        message: 'Phone must be a valid 10-digit Indian mobile number',
      });
    }

    if (newPassword.length < 6) {
      return error(res, {
        statusCode: 400,
        message: 'New password must be at least 6 characters',
      });
    }

    // 1. Verify the OTP — this marks it as used internally on success
    const isOtpValid = await otpService.verifyOtp(phone, 'forgot_password', otp);
    if (!isOtpValid) {
      return error(res, {
        statusCode: 400,
        message: 'Invalid or expired OTP',
      });
    }

    // 2. Find the account (same priority order as login: super_admin → admin → user)
    let account =
      (await SuperAdmin.scope('withPassword').findOne({ where: { phone } })) ||
      (await Admin.scope('withPassword').findOne({ where: { phone } })) ||
      (await User.scope('withPassword').findOne({ where: { phone } }));

    if (!account) {
      return error(res, {
        statusCode: 404,
        message: 'No account found with this phone number',
      });
    }

    // 3. Hash and save the new password
    account.password = await bcrypt.hash(newPassword, 10);
    await account.save();

    return success(res, {
      statusCode: 200,
      message: 'Password reset successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh-token
 * Body: { refreshToken: string }
 *
 * Verifies the refresh token, issues a fresh access token, and rotates
 * the refresh token (old one is implicitly abandoned — client must store
 * the new one).
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return error(res, {
        statusCode: 400,
        message: 'Refresh token is required',
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (err) {
      return error(res, {
        statusCode: 401,
        message: 'Invalid or expired refresh token',
      });
    }

    // Rebuild the payload — only carry forward the fields we originally put in
    const payload = { id: decoded.id, role: decoded.role };
    if (decoded.role === 'admin' && decoded.zone_location_id) {
      payload.zone_location_id = decoded.zone_location_id;
    }

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    return success(res, {
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { registerUser, loginUser, forgotPasswordReset, refreshToken };