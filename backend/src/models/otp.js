'use strict';

module.exports = (sequelize, DataTypes) => {
  const OTP = sequelize.define(
    'OTP',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      phone: {
        type: DataTypes.STRING(15),
        allowNull: false,
      },
      otp_hash: {
        // The OTP is NEVER stored in plaintext - only a bcrypt hash of it.
        // This matters: this table is a juicy target, and OTPs are short enough
        // to be brute-forced quickly if leaked in plaintext.
        type: DataTypes.STRING,
        allowNull: false,
      },
      purpose: {
        type: DataTypes.ENUM('registration', 'forgot_password'),
        allowNull: false,
      },
      role: {
        // Which table to check/update against once verified.
        // Registration OTPs are always 'user'; forgot-password can be any role.
        type: DataTypes.ENUM('user', 'admin', 'super_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      attempts: {
        // Number of failed verification attempts against this OTP.
        // Locked out after MAX_OTP_ATTEMPTS (enforced in the service layer).
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      is_used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      tableName: 'otps',
      indexes: [
        { fields: ['phone'] },
        { fields: ['phone', 'purpose'] },
        { fields: ['expires_at'] },
      ],
    }
  );

  return OTP;
};
