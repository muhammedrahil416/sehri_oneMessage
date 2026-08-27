'use strict';
const bcrypt = require('bcryptjs');
const db = require('../models');
const otpService = require('../services/otpService');
const { success, error } = require('../utils/response');
const { signAccessToken, signRefreshToken } = require('../utils/jwt');

const { User, Location, Admin, SuperAdmin } = db;
const registerUser = async (req, res) => {
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
    console.error('Registration error:', err);
    return error(res, {
      statusCode: 500,
      message: 'Server error',
    });
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
const loginUser = async (req, res) => {
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
    console.error('Login error:', err);
    return error(res, {
      statusCode: 500,
      message: 'Server error',
    });
  }
};

module.exports = { registerUser, loginUser };