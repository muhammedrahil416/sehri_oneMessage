'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('otps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      phone: {
        type: Sequelize.STRING(15),
        allowNull: false,
      },
      otp_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      purpose: {
        type: Sequelize.ENUM('registration', 'forgot_password'),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('user', 'admin', 'super_admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      is_used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('otps', ['phone']);
    await queryInterface.addIndex('otps', ['phone', 'purpose']);
    await queryInterface.addIndex('otps', ['expires_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('otps');
  },
};
