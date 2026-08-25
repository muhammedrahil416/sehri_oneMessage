'use strict';

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const db = require('../models');
const { compareOtp } = require('../utils/otp');
const { success, error } = require('../utils/response');

const { User, OTP, Location } = db;

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

    // 1. Find the latest unused registration OTP
    const otpRecord = await OTP.findOne({
      where: {
        phone,
        purpose: 'registration',
        is_used: false,
        expires_at: {
          [Op.gt]: new Date(),
        },
      },
      order: [['createdAt', 'DESC']],
    });

    if (!otpRecord) {
      return error(res, {
        statusCode: 400,
        message: 'OTP not found or expired',
      });
    }

    // 2. Verify OTP
    const isOtpValid = await compareOtp(otp, otpRecord.otp_hash);

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

    // 4. Check whether location exists
    const location = await Location.findByPk(location_id);

    if (!location) {
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

    // 7. Mark OTP as used
    otpRecord.is_used = true;
    await otpRecord.save();

    // 8. Send response
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

module.exports = { registerUser };