'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      gender: {
        type: Sequelize.ENUM('male', 'female'),
        allowNull: false,
      },
      occupation: {
        type: Sequelize.ENUM('student', 'employee', 'others'),
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING(100),
        defaultValue: 'Bangalore',
      },
      location_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'locations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
      },
      is_phone_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      fcm_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      profile_picture: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('users', ['phone'], { unique: true });
    await queryInterface.addIndex('users', ['location_id']);
    await queryInterface.addIndex('users', ['status']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  },
};
